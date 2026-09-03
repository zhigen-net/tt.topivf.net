import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiKeysService } from './api-keys.service'
import { CreateApiKeyDto } from './dto/api-key.dto'
import { MCP_SCOPES } from './api-key.entity'
import { Roles } from './roles.decorator'

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('api-keys')
@Roles('admin')
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  @Get('scopes')
  scopes() {
    return MCP_SCOPES
  }

  @Get()
  findAll() {
    return this.svc.findAll()
  }

  @Post()
  create(@Body() dto: CreateApiKeyDto) {
    return this.svc.create(dto)
  }

  @Post(':id/revoke')
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.revoke(id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id)
  }
}
