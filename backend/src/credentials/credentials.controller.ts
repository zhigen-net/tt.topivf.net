import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CredentialsService } from './credentials.service'
import { CreateCredentialDto, RotateTokenDto } from './dto/create-credential.dto'
import { LinkTargetsDto } from './dto/link-targets.dto'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from '../workspaces/workspace-context'

@ApiTags('credentials')
@ApiBearerAuth()
// 令牌是整个商务管理平台的发布权限，读写一律限管理员
@MinWorkspaceRole('manager')
@Controller('credentials')
export class CredentialsController {
  constructor(private readonly svc: CredentialsService) {}

  @Get()
  findAll(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findAll(ws.id)
  }

  @Post()
  create(@Body() dto: CreateCredentialDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.create(dto.label, dto.token, ws.id)
  }

  @Post(':id/discover')
  discover(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.discover(id, ws.id)
  }

  @Post(':id/link')
  link(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkTargetsDto,
    @CurrentWorkspace() ws: WorkspaceContext,
  ) {
    return this.svc.link(id, dto.targets, ws.id)
  }

  @Post(':id/refresh')
  refresh(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.refresh(id, ws.id)
  }

  @Post(':id/rotate')
  rotate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RotateTokenDto,
    @CurrentWorkspace() ws: WorkspaceContext,
  ) {
    return this.svc.rotate(id, dto.token, ws.id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.remove(id, ws.id)
  }
}
