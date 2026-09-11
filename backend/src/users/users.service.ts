import {
  BadRequestException, ConflictException, Injectable, Logger,
  NotFoundException, OnModuleInit, UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Not, Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { User } from './user.entity'
import { ChangePasswordDto, CreateUserDto, UpdateProfileDto, UpdateUserDto } from './dto/user.dto'
import { Workspace } from '../workspaces/workspace.entity'
import { WorkspaceMember, type WorkspaceRole } from '../workspaces/workspace-member.entity'

const ROUNDS = 10

export type UserWorkspace = { id: string, name: string, role: WorkspaceRole }

/** 邮箱大小写不敏感，统一按小写存，登录时也按小写比 */
function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @InjectRepository(Workspace) private workspaces: Repository<Workspace>,
    @InjectRepository(WorkspaceMember) private members: Repository<WorkspaceMember>,
    private readonly ds: DataSource,
  ) {}

  /** 空库时补一个管理员，否则新部署没人能登录 */
  async onModuleInit() {
    if (await this.repo.count() > 0) return
    const password = process.env.ADMIN_PASSWORD ?? 'admin123'
    await this.repo.save(this.repo.create({
      username: 'admin',
      email: normalizeEmail(process.env.ADMIN_EMAIL ?? 'admin@socialhub.local'),
      passwordHash: await bcrypt.hash(password, ROUNDS),
      displayName: '管理员',
      role: 'admin',
    }))
    this.logger.warn('已创建初始管理员 admin，请尽快修改密码')
  }

  async findAll() {
    const users = await this.repo.find({ order: { createdAt: 'ASC' } })
    if (!users.length) return []

    const rows = await this.members.find({
      where: { userId: In(users.map((u) => u.id)) },
      relations: { workspace: true },
      order: { createdAt: 'ASC' },
    })
    const byUser = new Map<string, UserWorkspace[]>()
    for (const m of rows) {
      if (!m.workspace) continue
      const item = { id: m.workspaceId, name: m.workspace.name, role: m.role }
      const list = byUser.get(m.userId)
      if (list) list.push(item)
      else byUser.set(m.userId, [item])
    }

    // 挂在实例上而不是展开成字面量：展开会丢掉类原型，@Exclude 失效，密码哈希就跟着出去了
    return users.map((u) => Object.assign(u, { workspaces: byUser.get(u.id) ?? [] }))
  }

  findById(id: string) {
    return this.repo.findOneBy({ id })
  }

  async findOne(id: string) {
    const user = await this.findById(id)
    if (!user) throw new NotFoundException(`User ${id} not found`)
    return user
  }

  /** 按关键词找启用中的用户，排除掉指定的 id；给空间邀请用 */
  searchActive(search: string, excludeIds: string[]) {
    const qb = this.repo.createQueryBuilder('u')
      .where('u.isActive = true')
      .andWhere(
        '(u.username ILIKE :search OR u.displayName ILIKE :search OR u.email ILIKE :search)',
        { search: `%${search}%` },
      )
    if (excludeIds.length) qb.andWhere('u.id NOT IN (:...excludeIds)', { excludeIds })
    return qb.orderBy('u.username', 'ASC').take(20).getMany()
  }

  /** 登录用：只认邮箱，取回带哈希的记录 */
  findByEmail(email: string) {
    return this.repo.findOneBy({ email: normalizeEmail(email) })
  }

  async create(dto: CreateUserDto, actorId: string) {
    if (await this.repo.findOneBy({ username: dto.username })) {
      throw new ConflictException('用户名已存在')
    }
    const email = await this.claimEmail(dto.email)
    // 放在事务外算，bcrypt 要几百毫秒，没必要占着连接
    const passwordHash = await bcrypt.hash(dto.password, ROUNDS)

    // 建号、建空间、写成员关系同生共死，否则会留下没归属的用户或没人管的空空间
    return this.ds.transaction(async (em) => {
      const user = await em.save(em.create(User, {
        username: dto.username,
        email,
        passwordHash,
        displayName: dto.displayName,
        role: dto.role ?? 'user',
      }))

      if (dto.workspaceMode === 'join') {
        if (!await em.existsBy(Workspace, { id: dto.workspaceId })) {
          throw new NotFoundException('工作空间不存在')
        }
        await em.save(em.create(WorkspaceMember, {
          workspaceId: dto.workspaceId,
          userId: user.id,
          role: dto.workspaceRole ?? 'member',
        }))
      }

      if (dto.workspaceMode === 'create') {
        const ws = await em.save(em.create(Workspace, {
          name: dto.workspaceName,
          createdById: user.id,
        }))
        // 新人是拥有者，但操作的管理员也得进来：否则新人成了唯一 manager，
        // assertNotSoleManager 会让这个号从建出来那刻起就删不掉
        await em.save([
          em.create(WorkspaceMember, { workspaceId: ws.id, userId: user.id, role: 'manager' }),
          em.create(WorkspaceMember, { workspaceId: ws.id, userId: actorId, role: 'manager' }),
        ])
      }

      return user
    })
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id)
    const losingAdmin = (dto.role !== undefined && dto.role !== 'admin') || dto.isActive === false
    if (user.role === 'admin' && losingAdmin) await this.assertNotLastAdmin(id)

    Object.assign(user, dto)
    if (dto.email !== undefined) user.email = await this.claimEmail(dto.email, id)
    return this.repo.save(user)
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.findOne(id)
    user.displayName = dto.displayName
    user.email = await this.claimEmail(dto.email, id)
    return this.repo.save(user)
  }

  /** 唯一索引在库里，但先在应用层拦一道才能给出中文提示而不是 500 */
  private async claimEmail(raw: string, ownerId?: string) {
    const email = normalizeEmail(raw)
    const owner = await this.repo.findOneBy({ email })
    if (owner && owner.id !== ownerId) throw new ConflictException('邮箱已被其它账号使用')
    return email
  }

  async resetPassword(id: string, password: string) {
    const user = await this.findOne(id)
    user.passwordHash = await bcrypt.hash(password, ROUNDS)
    await this.repo.save(user)
  }

  async changeOwnPassword(id: string, dto: ChangePasswordDto) {
    const user = await this.findOne(id)
    if (!await bcrypt.compare(dto.currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('当前密码不正确')
    }
    user.passwordHash = await bcrypt.hash(dto.password, ROUNDS)
    await this.repo.save(user)
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException('不能删除自己')
    const user = await this.findOne(id)
    if (user.role === 'admin') await this.assertNotLastAdmin(id)
    await this.assertNotSoleManager(id)
    await this.repo.delete(id)
  }

  async touchLogin(id: string) {
    await this.repo.update(id, { lastLoginAt: new Date() })
  }

  /**
   * 删掉某空间的唯一 manager 会让那个空间彻底失管。这里直接查表而不是注入
   * WorkspacesService，因为工作空间模块反过来依赖本服务。
   */
  private async assertNotSoleManager(userId: string) {
    const rows = await this.ds.query<{ name: string }[]>(
      `SELECT w.name FROM workspaces w
       JOIN workspace_members m ON m.workspace_id = w.id AND m.user_id = $1 AND m.role = 'manager'
       WHERE (SELECT COUNT(*) FROM workspace_members x
              WHERE x.workspace_id = w.id AND x.role = 'manager') = 1`,
      [userId],
    )
    if (rows.length) {
      const names = rows.map((r) => r.name).join('、')
      throw new BadRequestException(`该用户是以下空间的唯一管理员，请先另指定管理员：${names}`)
    }
  }

  private async assertNotLastAdmin(excludeId: string) {
    const others = await this.repo.count({ where: { role: 'admin', isActive: true, id: Not(excludeId) } })
    if (others === 0) throw new BadRequestException('至少要保留一个启用的管理员')
  }
}
