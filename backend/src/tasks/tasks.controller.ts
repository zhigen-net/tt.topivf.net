import { Controller, Get, Post, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { TasksService } from './tasks.service'
import { PublishTask } from './publish-task.entity'

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  @Get()
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) { return this.svc.findAll(page, limit) }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id) }

  @Post()
  create(@Body() dto: Partial<PublishTask>) { return this.svc.create(dto) }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) { return this.svc.remove(id) }
}
