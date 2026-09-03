import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { WorkspacesService } from './workspaces.service'
import {
  AddMemberDto, CreateWorkspaceDto, SearchUsersDto, UpdateMemberDto, UpdateWorkspaceDto,
} from './dto/workspace.dto'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from './workspace-context'
import { Roles } from '../auth/roles.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import type { User } from '../users/user.entity'

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly svc: WorkspacesService) {}

  @Get()
  findVisible(@CurrentUser() me: User) {
    return this.svc.findVisibleWithRole(me)
  }

  /** 当前请求落在哪个空间、我在里面是什么角色——前端切换器靠它校准 */
  @Get('current')
  current(@CurrentWorkspace() ws?: WorkspaceContext) {
    return ws ?? null
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateWorkspaceDto, @CurrentUser() me: User) {
    return this.svc.create(dto, me)
  }

  @Patch(':id')
  @MinWorkspaceRole('manager', 'id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.svc.update(id, dto.name)
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id)
  }

  @Get(':id/members')
  @MinWorkspaceRole('viewer', 'id')
  listMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listMembers(id)
  }

  @Get(':id/candidates')
  @MinWorkspaceRole('manager', 'id')
  findCandidates(@Param('id', ParseUUIDPipe) id: string, @Query() query: SearchUsersDto) {
    return this.svc.findCandidates(id, query.search)
  }

  @Post(':id/members')
  @MinWorkspaceRole('manager', 'id')
  addMember(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddMemberDto) {
    return this.svc.addMember(id, dto)
  }

  @Patch(':id/members/:memberId')
  @MinWorkspaceRole('manager', 'id')
  updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.svc.updateMember(id, memberId, dto)
  }

  @Delete(':id/members/:memberId')
  @MinWorkspaceRole('manager', 'id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.svc.removeMember(id, memberId)
  }
}
