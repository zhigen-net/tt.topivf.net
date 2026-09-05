import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { StatsSnapshot } from './stats-snapshot.entity'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { MetricsScheduler } from './metrics.scheduler'
import { Account } from '../accounts/account.entity'
import { AccountsModule } from '../accounts/accounts.module'
import { PostsModule } from '../posts/posts.module'

@Module({
  imports: [TypeOrmModule.forFeature([StatsSnapshot, Account]), AccountsModule, PostsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, MetricsScheduler],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
