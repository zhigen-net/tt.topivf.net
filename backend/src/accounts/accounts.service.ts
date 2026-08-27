import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, FindOptionsWhere, ILike } from 'typeorm'
import { Account, Platform, AccountStatus } from './account.entity'
import { CreateAccountDto } from './dto/create-account.dto'
import type { PlatformsService } from '../platforms/platforms.service'

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name)
  constructor(@InjectRepository(Account) private repo: Repository<Account>) {}

  async findAll(opts: { platform?: Platform; status?: AccountStatus; search?: string; page?: number; limit?: number }) {
    const { platform, status, search, page = 1, limit = 20 } = opts
    const where: FindOptionsWhere<Account> = {}
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

  async findOne(id: string) {
    const account = await this.repo.findOne({ where: { id }, relations: { proxy: true } })
    if (!account) throw new NotFoundException(`Account ${id} not found`)
    return account
  }

  async create(dto: CreateAccountDto) {
    const account = this.repo.create(dto)
    return this.repo.save(account)
  }

  async update(id: string, dto: Partial<CreateAccountDto>) {
    await this.findOne(id)
    await this.repo.update(id, dto as any)
    return this.findOne(id)
  }

  async remove(id: string) {
    const account = await this.findOne(id)
    await this.repo.remove(account)
  }

  async updateStatus(id: string, status: AccountStatus) {
    await this.repo.update(id, { status })
    return this.findOne(id)
  }

  async updateStats(id: string, stats: Partial<Pick<Account, 'followers' | 'following' | 'postsCount'>>) {
    await this.repo.update(id, { ...stats, lastActiveAt: new Date() })
  }

  async sync(id: string, platforms: PlatformsService): Promise<Account & { healthy: boolean }> {
    const account = await this.findOne(id)
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

    const updated = await this.findOne(id)
    return { ...updated, healthy }
  }
}
