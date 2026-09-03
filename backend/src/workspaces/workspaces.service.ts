import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Repository } from 'typeorm'
import { Workspace } from './workspace.entity'
import { WorkspaceMember, type WorkspaceRole } from './workspace-member.entity'
import { AddMemberDto, CreateWorkspaceDto, UpdateMemberDto } from './dto/workspace.dto'
import { UsersService } from '../users/users.service'
import type { User } from '../users/user.entity'

/** 归属列叫 workspace_id 的表，删空间前要确认它们是空的 */
const OWNED_TABLES = ['accounts', 'proxies', 'contents', 'publish_tasks', 'assets'] as const

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace) private repo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember) private members: Repository<WorkspaceMember>,
    private readonly users: UsersService,
    private readonly ds: DataSource,
  ) {}

  /** 平台管理员看得到全部空间，普通用户只看自己加入的 */
  async findVisible(actor: User) {
    if (actor.role === 'admin') return this.repo.find({ order: { createdAt: 'ASC' } })
    const rows = await this.members.find({ where: { userId: actor.id } })
    if (!rows.length) return []
    return this.repo.find({ where: { id: In(rows.map((m) => m.workspaceId)) }, order: { createdAt: 'ASC' } })
  }

  /** 列表里直接带上「我在这个空间是什么角色」，前端切换器不用再逐个问 */
  async findVisibleWithRole(actor: User) {
    const list = await this.findVisible(actor)
    if (actor.role === 'admin') return list.map((w) => ({ ...w, role: 'manager' as WorkspaceRole }))
    const roles = new Map(
      (await this.members.find({ where: { userId: actor.id } })).map((m) => [m.workspaceId, m.role]),
    )
    return list.map((w) => ({ ...w, role: roles.get(w.id)! }))
  }

  /**
   * 解析某人在某空间的角色。平台管理员按 manager 对待，但仍要求空间真实存在，
   * 免得一个拼错的 id 被当成有权访问。
   */
  async resolveRole(workspaceId: string, actor: User): Promise<WorkspaceRole | null> {
    if (!await this.repo.existsBy({ id: workspaceId })) return null
    if (actor.role === 'admin') return 'manager'
    const member = await this.members.findOneBy({ workspaceId, userId: actor.id })
    return member?.role ?? null
  }

  async findOne(id: string) {
    const ws = await this.repo.findOneBy({ id })
    if (!ws) throw new NotFoundException('工作空间不存在')
    return ws
  }

  async create(dto: CreateWorkspaceDto, actor: User) {
    const ws = await this.repo.save(this.repo.create({ name: dto.name, createdById: actor.id }))
    // 建空间的人自动成为 manager，否则新空间没人管得了
    await this.members.save(this.members.create({
      workspaceId: ws.id, userId: actor.id, role: 'manager',
    }))
    return ws
  }

  async update(id: string, name: string) {
    const ws = await this.findOne(id)
    ws.name = name
    return this.repo.save(ws)
  }

  async remove(id: string) {
    await this.findOne(id)
    const blockers: string[] = []
    for (const table of OWNED_TABLES) {
      const [{ count }] = await this.ds.query<{ count: string }[]>(
        `SELECT COUNT(*)::text AS count FROM ${table} WHERE workspace_id = $1`,
        [id],
      )
      if (Number(count) > 0) blockers.push(`${table}(${count})`)
    }
    if (blockers.length) {
      throw new BadRequestException(`空间下还有数据，请先迁走或删除：${blockers.join('、')}`)
    }
    await this.repo.delete(id)
  }

  listMembers(workspaceId: string) {
    return this.members.find({
      where: { workspaceId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    })
  }

  /**
   * 可邀请的人。空间管理员不一定是平台管理员，不能让他去读 /users 全表，
   * 所以这里只回最少的几个字段，且必须给关键词、一次最多 20 条。
   */
  async findCandidates(workspaceId: string, search: string) {
    const existing = await this.members.find({ where: { workspaceId }, select: { userId: true } })
    const rows = await this.users.searchActive(search, existing.map((m) => m.userId))
    return rows.map((u) => ({ id: u.id, username: u.username, displayName: u.displayName }))
  }

  async addMember(workspaceId: string, dto: AddMemberDto) {
    await this.findOne(workspaceId)
    const user = await this.users.findById(dto.userId)
    if (!user) throw new NotFoundException('用户不存在')
    if (!user.isActive) throw new BadRequestException('不能邀请已停用的用户')
    if (await this.members.findOneBy({ workspaceId, userId: dto.userId })) {
      throw new ConflictException('该用户已在空间内')
    }
    const saved = await this.members.save(this.members.create({
      workspaceId, userId: dto.userId, role: dto.role,
    }))
    return this.members.findOne({ where: { id: saved.id }, relations: { user: true } })
  }

  async updateMember(workspaceId: string, memberId: string, dto: UpdateMemberDto) {
    const member = await this.getMember(workspaceId, memberId)
    if (member.role === 'manager' && dto.role !== 'manager') {
      await this.assertNotLastManager(workspaceId, member.userId)
    }
    member.role = dto.role
    await this.members.save(member)
    return this.members.findOne({ where: { id: member.id }, relations: { user: true } })
  }

  async removeMember(workspaceId: string, memberId: string) {
    const member = await this.getMember(workspaceId, memberId)
    if (member.role === 'manager') await this.assertNotLastManager(workspaceId, member.userId)
    await this.members.delete(member.id)
    return member
  }

  private async getMember(workspaceId: string, memberId: string) {
    const member = await this.members.findOneBy({ id: memberId, workspaceId })
    if (!member) throw new NotFoundException('成员不存在')
    return member
  }

  private async assertNotLastManager(workspaceId: string, excludeUserId: string) {
    const others = await this.members.count({
      where: { workspaceId, role: 'manager' },
    })
    const self = await this.members.count({
      where: { workspaceId, role: 'manager', userId: excludeUserId },
    })
    if (others - self <= 0) throw new BadRequestException('空间至少要保留一个管理员')
  }
}
