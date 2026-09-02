import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AccountsService } from './accounts.service'
import { CreateAccountDto } from './dto/create-account.dto'
import { UpdateAccountDto, UpdateStatusDto } from './dto/update-account.dto'
import { QueryAccountsDto } from './dto/query-accounts.dto'
import { PlatformsService } from '../platforms/platforms.service'

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly svc: AccountsService,
    private readonly platforms: PlatformsService,
  ) {}

  @Get()
  findAll(@Query() query: QueryAccountsDto) {
    return this.svc.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.svc.create(dto)
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccountDto) {
    return this.svc.update(id, dto)
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStatusDto) {
    return this.svc.updateStatus(id, dto.status)
  }

  @Post(':id/sync')
  sync(@Param('id') id: string) {
    return this.svc.sync(id, this.platforms)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }
}
