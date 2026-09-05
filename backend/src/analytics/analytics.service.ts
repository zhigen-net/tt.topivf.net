import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StatsSnapshot } from './stats-snapshot.entity'
import { Account } from '../accounts/account.entity'

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(StatsSnapshot) private repo: Repository<StatsSnapshot>,
    @InjectRepository(Account) private accounts: Repository<Account>,
  ) {}

  // 快照本身不带空间列，隔离靠它挂的账号来判定
  async getByAccount(accountId: string, workspaceId: string) {
    if (!await this.accounts.existsBy({ id: accountId, workspaceId })) {
      throw new NotFoundException(`Account ${accountId} not found`)
    }
    return this.repo.find({ where: { accountId }, order: { recordedAt: 'DESC' }, take: 30 })
  }

  record(data: Partial<StatsSnapshot>) { return this.repo.save(this.repo.create(data)) }

  /**
   * 每天给账号留一张快照。判重看的是库里最新一条的时间而不是调度器的计时器——
   * sh_api 重启很频繁，计时器每次都从头开始，只靠间隔会在一天内堆出十几张。
   */
  async snapshotIfDue(account: Account, minGapMs: number): Promise<boolean> {
    const latest = await this.repo.findOne({
      where: { accountId: account.id },
      order: { recordedAt: 'DESC' },
    })
    if (latest && Date.now() - latest.recordedAt.getTime() < minGapMs) return false

    await this.record({
      accountId: account.id,
      platform: account.platform,
      followers: account.followers,
      following: account.following,
    })
    return true
  }
}
