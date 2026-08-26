import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ProxiesService } from './proxies.service'
import { Proxy } from './proxy.entity'

@ApiTags('proxies')
@ApiBearerAuth()
@Controller('proxies')
export class ProxiesController {
  constructor(private readonly svc: ProxiesService) {}

  @Get() findAll() { return this.svc.findAll() }
  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id) }
  @Post() create(@Body() dto: Partial<Proxy>) { return this.svc.create(dto) }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: Partial<Proxy>) { return this.svc.update(id, dto) }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(@Param('id') id: string) { return this.svc.remove(id) }
}
