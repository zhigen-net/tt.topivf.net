import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiKeysService } from './api-keys.service'
import { CreateApiKeyDto } from './dto/api-key.dto'
import { MCP_SCOPES } from './api-key.entity'
import { CurrentUser } from './current-user.decorator'
import type { User } from '../users/user.entity'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from '../workspaces/workspace-context'

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('api-keys')
@MinWorkspaceRole('member')
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  @Get('scopes')
  scopes() {
    return MCP_SCOPES
  }

  @Get()
  findAll(@CurrentWorkspace() ws: WorkspaceContext, @CurrentUser() actor: User) {
    return this.svc.findAll(ws, actor)
  }

  @Post()
  create(
    @Body() dto: CreateApiKeyDto,
    @CurrentWorkspace() ws: WorkspaceContext,
    @CurrentUser() actor: User,
  ) {
    return this.svc.create(dto, ws, actor)
  }

  @Post(':id/revoke')
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() ws: WorkspaceContext,
    @CurrentUser() actor: User,
  ) {
    return this.svc.revoke(id, ws, actor)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() ws: WorkspaceContext,
    @CurrentUser() actor: User,
  ) {
    return this.svc.remove(id, ws, actor)
  }
}
