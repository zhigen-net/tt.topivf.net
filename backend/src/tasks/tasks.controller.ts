import { Controller, Get, Post, Delete, Param, Body, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { TasksService } from './tasks.service'
import { BulkCreateTaskDto, CreateTaskDto } from './dto/create-task.dto'
import { QueryTasksDto } from './dto/query-tasks.dto'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from '../workspaces/workspace-context'

@ApiTags('tasks')
@ApiBearerAuth()
@MinWorkspaceRole('viewer')
@Controller('tasks')
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  @Get()
  findAll(@Query() query: QueryTasksDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findAll(ws.id, query.page, query.limit, query.accountId, query.contentId)
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findOne(id, ws.id)
  }

  @Post()
  @MinWorkspaceRole('member')
  create(@Body() dto: CreateTaskDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.create(dto, ws.id)
  }

  @Post('bulk')
  @MinWorkspaceRole('member')
  bulkCreate(@Body() dto: BulkCreateTaskDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.bulkCreate(dto, ws.id)
  }

  @Delete(':id')
  @MinWorkspaceRole('manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.remove(id, ws.id)
  }
}
