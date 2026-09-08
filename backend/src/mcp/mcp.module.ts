import { Module } from '@nestjs/common'
import { McpController } from './mcp.controller'
import { McpService } from './mcp.service'
import { ContentsModule } from '../contents/contents.module'
import { AccountsModule } from '../accounts/accounts.module'
import { TasksModule } from '../tasks/tasks.module'
import { AnalyticsModule } from '../analytics/analytics.module'
import { AssetsModule } from '../assets/assets.module'
import { CommentsModule } from '../comments/comments.module'

@Module({
  imports: [
    ContentsModule, AccountsModule, TasksModule, AnalyticsModule, AssetsModule, CommentsModule,
  ],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
