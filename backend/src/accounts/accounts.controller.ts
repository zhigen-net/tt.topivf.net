import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AccountsService } from './accounts.service'
import { CreateAccountDto } from './dto/create-account.dto'
import { UpdateAccountDto, UpdateStatusDto } from './dto/update-account.dto'
import { QueryAccountsDto } from './dto/query-accounts.dto'
import { BulkAccountIdsDto, BulkAccountStatusDto } from './dto/bulk-accounts.dto'
import { PlatformsService } from '../platforms/platforms.service'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from '../workspaces/workspace-context'

@ApiTags('accounts')
@ApiBearerAuth()
@MinWorkspaceRole('viewer')
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly svc: AccountsService,
    private readonly platforms: PlatformsService,
  ) {}

  @Get()
  findAll(@Query() query: QueryAccountsDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findAll(ws.id, query)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findOne(id, ws.id)
  }

  @Post()
  @MinWorkspaceRole('member')
  create(@Body() dto: CreateAccountDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.create(dto, ws.id)
  }

  @Patch(':id')
  @MinWorkspaceRole('member')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentWorkspace() ws: WorkspaceContext,
  ) {
    return this.svc.update(id, dto, ws.id)
  }

  @Patch(':id/status')
  @MinWorkspaceRole('member')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentWorkspace() ws: WorkspaceContext,
  ) {
    return this.svc.updateStatus(id, dto.status, ws.id)
  }

  @Post('bulk-status')
  @MinWorkspaceRole('member')
  bulkStatus(@Body() dto: BulkAccountStatusDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.bulkUpdateStatus(dto.ids, dto.status, ws.id)
  }

  @Post('bulk-delete')
  @MinWorkspaceRole('manager')
  bulkRemove(@Body() dto: BulkAccountIdsDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.bulkRemove(dto.ids, ws.id)
  }

  @Post(':id/sync')
  @MinWorkspaceRole('member')
  sync(@Param('id') id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.sync(id, ws.id, this.platforms)
  }

  @Delete(':id')
  @MinWorkspaceRole('manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.remove(id, ws.id)
  }
}
