import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { StatsSnapshot } from './stats-snapshot.entity'

@Injectable()
export class AnalyticsService {
  constructor(@InjectRepository(StatsSnapshot) private repo: Repository<StatsSnapshot>) {}

  getByAccount(accountId: string) {
    return this.repo.find({ where: { accountId }, order: { recordedAt: 'DESC' }, take: 30 })
  }

  record(data: Partial<StatsSnapshot>) { return this.repo.save(this.repo.create(data)) }
}
