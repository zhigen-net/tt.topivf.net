import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, FindOptionsWhere, ILike } from 'typeorm'
import { Account, Platform, AccountStatus } from './account.entity'
import { CreateAccountDto } from './dto/create-account.dto'
import { UpdateAccountDto } from './dto/update-account.dto'
import { Proxy } from '../proxies/proxy.entity'
import { BrowserManager } from '../platforms/browser-manager.service'
import type { PlatformsService } from '../platforms/platforms.service'

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name)
  constructor(
    @InjectRepository(Account) private repo: Repository<Account>,
    @InjectRepository(Proxy) private proxies: Repository<Proxy>,
    private readonly browserManager: BrowserManager,
  ) {}

  /** 绑代理是跨表引用，不校验就能把别的空间的代理挂到自己账号上 */
  private async assertProxyInWorkspace(proxyId: string | null | undefined, workspaceId: string) {
    if (!proxyId) return
    if (!await this.proxies.existsBy({ id: proxyId, workspaceId })) {
      throw new NotFoundException('代理不存在或不属于当前工作空间')
    }
  }

  async findAll(
    workspaceId: string,
    opts: { platform?: Platform; status?: AccountStatus; search?: string; page?: number; limit?: number },
  ) {
    const { platform, status, search, page = 1, limit = 20 } = opts
    const where: FindOptionsWhere<Account> = { workspaceId }
    if (platform) where.platform = platform
    if (status) where.status = status
    if (search) where.username = ILike(`%${search}%`)

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: { proxy: true },
    })

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  /** 不过滤空间，只给后台任务用；任何走 HTTP 的路径都必须用 findOne */
  async findById(id: string) {
    const account = await this.repo.findOne({ where: { id }, relations: { proxy: true } })
    if (!account) throw new NotFoundException(`Account ${id} not found`)
    return account
  }

  async findOne(id: string, workspaceId: string) {
    const account = await this.repo.findOne({ where: { id, workspaceId }, relations: { proxy: true } })
    if (!account) throw new NotFoundException(`Account ${id} not found`)
    return account
  }

  /** 批量校验账号确实都在本空间内，返回顺序与入参一致 */
  async findAllByIds(ids: string[], workspaceId: string) {
    return Promise.all(ids.map((id) => this.findOne(id, workspaceId)))
  }

  async create(dto: CreateAccountDto, workspaceId: string) {
    await this.assertProxyInWorkspace(dto.proxyId, workspaceId)
    const account = this.repo.create({ ...dto, workspaceId })
    return this.repo.save(account)
  }

  async update(id: string, dto: UpdateAccountDto, workspaceId: string) {
    await this.findOne(id, workspaceId)
    await this.assertProxyInWorkspace(dto.proxyId, workspaceId)
    await this.repo.update(id, dto as any)
    // cookie 只在 context 创建那一刻注入，不丢掉缓存的话新 cookie 永远不会生效
    if (dto.sessionData !== undefined || dto.proxyId !== undefined) {
      await this.browserManager.closeContext(id)
    }
    return this.findOne(id, workspaceId)
  }

  async remove(id: string, workspaceId: string) {
    const account = await this.findOne(id, workspaceId)
    await this.repo.remove(account)
    await this.browserManager.closeContext(id)
  }

  async updateStatus(id: string, status: AccountStatus, workspaceId: string) {
    await this.findOne(id, workspaceId)
    await this.repo.update(id, { status })
    return this.findOne(id, workspaceId)
  }

  async updateStats(id: string, stats: Partial<Pick<Account, 'followers' | 'following' | 'postsCount'>>) {
    await this.repo.update(id, { ...stats, lastActiveAt: new Date() })
  }

  async sync(id: string, workspaceId: string, platforms: PlatformsService): Promise<Account & { healthy: boolean }> {
    const account = await this.findOne(id, workspaceId)
    const adapter = platforms.getAdapter(account.platform)

    let healthy = account.status === 'active'

    if (adapter) {
      try {
        const [stats, isHealthy] = await Promise.all([
          adapter.fetchStats(account),
          adapter.checkHealth(account),
        ])
        healthy = isHealthy
        await this.repo.update(id, {
          followers: stats.followers,
          following: stats.following,
          postsCount: stats.postsCount,
          lastActiveAt: new Date(),
        })
        this.logger.log(`Synced ${account.platform} @${account.username}: ${stats.followers} followers, healthy=${isHealthy}`)
      } catch (err) {
        this.logger.warn(`Sync failed for ${account.platform} @${account.username}: ${err}`)
      }
    }

    const updated = await this.findOne(id, workspaceId)
    // 必须保留 Account 实例，展开成普通对象会让 @Exclude 失效、把凭证漏出去
    return Object.assign(updated, { healthy })
  }
}
