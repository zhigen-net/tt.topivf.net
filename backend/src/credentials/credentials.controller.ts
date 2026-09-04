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
@MinWorkspaceRole('viewer')
@Controller('credentials')
export class CredentialsController {
  constructor(private readonly svc: CredentialsService) {}

  @Get()
  findAll(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findAll(ws.id)
  }

  @Post()
  @MinWorkspaceRole('manager')
  create(@Body() dto: CreateCredentialDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.create(dto.label, dto.token, ws.id)
  }

  @Post(':id/discover')
  @MinWorkspaceRole('member')
  discover(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.discover(id, ws.id)
  }

  @Post(':id/link')
  @MinWorkspaceRole('member')
  link(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkTargetsDto,
    @CurrentWorkspace() ws: WorkspaceContext,
  ) {
    return this.svc.link(id, dto.targets, ws.id)
  }

  @Post(':id/refresh')
  @MinWorkspaceRole('member')
  refresh(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.refresh(id, ws.id)
  }

  // 换令牌等于交出整个商务管理平台的发布权限，跟建凭证同级
  @Post(':id/rotate')
  @MinWorkspaceRole('manager')
  rotate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RotateTokenDto,
    @CurrentWorkspace() ws: WorkspaceContext,
  ) {
    return this.svc.rotate(id, dto.token, ws.id)
  }

  @Delete(':id')
  @MinWorkspaceRole('manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.remove(id, ws.id)
  }
}
