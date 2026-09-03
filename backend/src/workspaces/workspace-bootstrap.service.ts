import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { Workspace } from './workspace.entity'
import { WorkspaceMember } from './workspace-member.entity'
import { User } from '../users/user.entity'

const DEFAULT_NAME = '默认工作空间'
const OWNED_TABLES = ['accounts', 'proxies', 'contents', 'publish_tasks', 'api_keys'] as const

/**
 * 引入工作空间前的数据没有归属列。这里把它们一次性收进默认空间，
 * 并让所有存量用户入会。全部条件都是 IS NULL / 不存在才写，重复启动无副作用。
 */
@Injectable()
export class WorkspaceBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceBootstrapService.name)

  constructor(
    @InjectRepository(Workspace) private repo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember) private members: Repository<WorkspaceMember>,
    @InjectRepository(User) private users: Repository<User>,
    private readonly ds: DataSource,
  ) {}

  async onModuleInit() {
    const admin = await this.users.findOne({ where: { role: 'admin' }, order: { createdAt: 'ASC' } })
    if (!admin) return

    const workspace = await this.ensureDefaultWorkspace(admin.id)
    await this.ensureMemberships(workspace.id)
    await this.backfillOwnership(workspace.id)
  }

  private async ensureDefaultWorkspace(adminId: string) {
    const existing = await this.repo.findOne({ where: {}, order: { createdAt: 'ASC' } })
    if (existing) return existing
    const created = await this.repo.save(this.repo.create({ name: DEFAULT_NAME, createdById: adminId }))
    this.logger.log(`已创建 ${DEFAULT_NAME}`)
    return created
  }

  private async ensureMemberships(workspaceId: string) {
    // CASE 的结果是 text，直接塞进枚举列 Postgres 不会隐式转，必须显式 cast；
    // 类型名是 TypeORM 按「表名_列名_enum」生成的
    const inserted = await this.ds.query<{ id: string }[]>(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       SELECT $1, u.id, (CASE WHEN u.role = 'admin' THEN 'manager' ELSE 'member' END)::workspace_members_role_enum
       FROM users u
       WHERE NOT EXISTS (
         SELECT 1 FROM workspace_members m WHERE m.workspace_id = $1 AND m.user_id = u.id
       )
       RETURNING id`,
      [workspaceId],
    )
    if (inserted.length) this.logger.log(`已为 ${inserted.length} 个存量用户补建成员关系`)
  }

  private async backfillOwnership(workspaceId: string) {
    for (const table of OWNED_TABLES) {
      await this.ds.query(
        `UPDATE ${table} SET workspace_id = $1 WHERE workspace_id IS NULL`,
        [workspaceId],
      )
    }
    // 作品的创建人历史上可能为空，补成管理员，免得后续按创建人过滤时漏掉
    await this.ds.query(
      `UPDATE contents SET created_by_id = (
         SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
       ) WHERE created_by_id IS NULL`,
    )
  }
}
