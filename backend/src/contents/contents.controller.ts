import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ContentsService } from './contents.service'
import { Content } from './content.entity'

@ApiTags('contents')
@ApiBearerAuth()
@Controller('contents')
export class ContentsController {
  constructor(private readonly svc: ContentsService) {}

  @Get()
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.svc.findAll(page, limit)
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id) }

  @Post()
  create(@Body() dto: Partial<Content>) { return this.svc.create(dto) }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<Content>) { return this.svc.update(id, dto) }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) { return this.svc.remove(id) }
}
