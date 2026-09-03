import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ProxiesService } from './proxies.service'
import { CreateProxyDto, UpdateProxyDto } from './dto/proxy.dto'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from '../workspaces/workspace-context'

@ApiTags('proxies')
@ApiBearerAuth()
@MinWorkspaceRole('viewer')
@Controller('proxies')
export class ProxiesController {
  constructor(private readonly svc: ProxiesService) {}

  @Get()
  findAll(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findAll(ws.id)
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findOne(id, ws.id)
  }

  @Post()
  @MinWorkspaceRole('member')
  create(@Body() dto: CreateProxyDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.create(dto, ws.id)
  }

  @Patch(':id')
  @MinWorkspaceRole('member')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProxyDto,
    @CurrentWorkspace() ws: WorkspaceContext,
  ) {
    return this.svc.update(id, dto, ws.id)
  }

  @Delete(':id')
  @MinWorkspaceRole('manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.remove(id, ws.id)
  }
}
