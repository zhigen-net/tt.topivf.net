import { Module } from '@nestjs/common'
import { McpController } from './mcp.controller'
import { McpService } from './mcp.service'
import { ContentsModule } from '../contents/contents.module'
import { AccountsModule } from '../accounts/accounts.module'
import { TasksModule } from '../tasks/tasks.module'
import { AnalyticsModule } from '../analytics/analytics.module'

@Module({
  imports: [ContentsModule, AccountsModule, TasksModule, AnalyticsModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
