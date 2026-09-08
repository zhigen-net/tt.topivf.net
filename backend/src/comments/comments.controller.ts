import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { CommentsService } from './comments.service'
import { QueryCommentsDto } from './dto/query-comments.dto'
import { IgnoreCommentDto, ReplyCommentDto } from './dto/reply-comment.dto'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from '../workspaces/workspace-context'

@ApiTags('comments')
@ApiBearerAuth()
@MinWorkspaceRole('viewer')
@Controller('comments')
export class CommentsController {
  constructor(private readonly svc: CommentsService) {}

  // 必须排在任何 ':id' 路由前面，否则会被当成 id
  @Get('pending-count')
  async pendingCount(@CurrentWorkspace() ws: WorkspaceContext) {
    return { count: await this.svc.pendingCount(ws.id) }
  }

  @Get('pending-by-account')
  pendingByAccount(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.pendingCountByAccount(ws.id)
  }

  @Get()
  findAll(@Query() query: QueryCommentsDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findAll(ws.id, query)
  }

  /** 定时任务几小时才跑一轮，等不及的时候手动拉一次 */
  @Post('sync')
  @MinWorkspaceRole('member')
  sync(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.syncWorkspace(ws.id)
  }

  @Post(':id/reply')
  @MinWorkspaceRole('member')
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyCommentDto,
    @CurrentWorkspace() ws: WorkspaceContext,
  ) {
    return this.svc.reply(id, dto.message, ws)
  }

  @Patch(':id/ignore')
  @MinWorkspaceRole('member')
  ignore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IgnoreCommentDto,
    @CurrentWorkspace() ws: WorkspaceContext,
  ) {
    return this.svc.setIgnored(id, dto.ignored, ws)
  }
}
