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
}
