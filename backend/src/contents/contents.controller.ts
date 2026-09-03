import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ContentsService } from './contents.service'
import { CreateContentDto } from './dto/create-content.dto'
import { UpdateContentDto } from './dto/update-content.dto'
import { QueryContentsDto } from './dto/query-contents.dto'
import { BulkIdsDto, BulkPlatformsDto } from './dto/bulk-contents.dto'
import { BulkReviewDto, ReviewContentDto } from './dto/review-content.dto'
import { CurrentUser } from '../auth/current-user.decorator'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from '../workspaces/workspace-context'
import type { User } from '../users/user.entity'

@ApiTags('contents')
@ApiBearerAuth()
@MinWorkspaceRole('viewer')
@Controller('contents')
export class ContentsController {
  constructor(private readonly svc: ContentsService) {}

  @Get()
  findAll(@Query() query: QueryContentsDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findAll(ws.id, query)
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findOne(id, ws.id)
  }

  @Post()
  @MinWorkspaceRole('member')
  create(@Body() dto: CreateContentDto, @CurrentWorkspace() ws: WorkspaceContext, @CurrentUser() me: User) {
    return this.svc.create(dto, ws, me)
  }

  // 批量操作走 POST 子路径，否则会被 :id 上的 ParseUUIDPipe 拦掉
  @Post('bulk-delete')
  @MinWorkspaceRole('member')
  bulkRemove(@Body() dto: BulkIdsDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.bulkRemove(dto.ids, ws)
  }

  @Post('bulk-platforms')
  @MinWorkspaceRole('member')
  bulkSetPlatforms(@Body() dto: BulkPlatformsDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.bulkSetPlatforms(dto.ids, dto.platforms, ws)
  }

  @Post('bulk-submit')
  @MinWorkspaceRole('member')
  bulkSubmit(@Body() dto: BulkIdsDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.bulkSubmit(dto.ids, ws)
  }

  @Post('bulk-review')
  @MinWorkspaceRole('member')
  bulkReview(@Body() dto: BulkReviewDto, @CurrentWorkspace() ws: WorkspaceContext, @CurrentUser() me: User) {
    return this.svc.bulkReview(dto.ids, dto.action, dto.note, ws, me)
  }

  @Post(':id/submit')
  @MinWorkspaceRole('member')
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.submit(id, ws)
  }

  @Post(':id/review')
  @MinWorkspaceRole('member')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewContentDto,
    @CurrentWorkspace() ws: WorkspaceContext,
    @CurrentUser() me: User,
  ) {
    return this.svc.review(id, dto.action, dto.note, ws, me)
  }

  @Patch(':id')
  @MinWorkspaceRole('member')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentDto,
    @CurrentWorkspace() ws: WorkspaceContext,
  ) {
    return this.svc.update(id, dto, ws)
  }

  @Delete(':id')
  @MinWorkspaceRole('member')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.remove(id, ws)
  }
}
