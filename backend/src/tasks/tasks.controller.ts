import { Controller, Get, Post, Delete, Param, Body, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { TasksService } from './tasks.service'
import { BulkCreateTaskDto, CreateTaskDto } from './dto/create-task.dto'
import { QueryTasksDto } from './dto/query-tasks.dto'

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  @Get()
  findAll(@Query() query: QueryTasksDto) {
    return this.svc.findAll(query.page, query.limit, query.accountId, query.contentId)
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id) }

  @Post()
  create(@Body() dto: CreateTaskDto) { return this.svc.create(dto) }

  @Post('bulk')
  bulkCreate(@Body() dto: BulkCreateTaskDto) { return this.svc.bulkCreate(dto) }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id) }
}
