import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StatsSnapshot } from './stats-snapshot.entity'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { Account } from '../accounts/account.entity'

@Module({
  imports: [TypeOrmModule.forFeature([StatsSnapshot, Account])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
