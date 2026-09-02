import {
  BadRequestException, ConflictException, Injectable, Logger,
  NotFoundException, OnModuleInit, UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Not, Repository } from 'typeorm'
import * as bcrypt from 'bcryptjs'
import { User } from './user.entity'
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from './dto/user.dto'

const ROUNDS = 10

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name)

  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  /** 空库时补一个管理员，否则新部署没人能登录 */
  async onModuleInit() {
    if (await this.repo.count() > 0) return
    const password = process.env.ADMIN_PASSWORD ?? 'admin123'
    await this.repo.save(this.repo.create({
      username: 'admin',
      passwordHash: await bcrypt.hash(password, ROUNDS),
      displayName: '管理员',
      role: 'admin',
    }))
    this.logger.warn('已创建初始管理员 admin，请尽快修改密码')
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'ASC' } })
  }

  findById(id: string) {
    return this.repo.findOneBy({ id })
  }

  async findOne(id: string) {
    const user = await this.findById(id)
    if (!user) throw new NotFoundException(`User ${id} not found`)
    return user
  }

  /** 登录用：按用户名取回带哈希的记录 */
  findByUsername(username: string) {
    return this.repo.findOneBy({ username })
  }

  async create(dto: CreateUserDto) {
    if (await this.repo.findOneBy({ username: dto.username })) {
      throw new ConflictException('用户名已存在')
    }
    return this.repo.save(this.repo.create({
      username: dto.username,
      passwordHash: await bcrypt.hash(dto.password, ROUNDS),
      displayName: dto.displayName,
      role: dto.role ?? 'user',
    }))
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id)
    const losingAdmin = (dto.role !== undefined && dto.role !== 'admin') || dto.isActive === false
    if (user.role === 'admin' && losingAdmin) await this.assertNotLastAdmin(id)

    Object.assign(user, dto)
    return this.repo.save(user)
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
    await this.repo.delete(id)
  }

  async touchLogin(id: string) {
    await this.repo.update(id, { lastLoginAt: new Date() })
  }

  private async assertNotLastAdmin(excludeId: string) {
    const others = await this.repo.count({ where: { role: 'admin', isActive: true, id: Not(excludeId) } })
    if (others === 0) throw new BadRequestException('至少要保留一个启用的管理员')
  }
}
