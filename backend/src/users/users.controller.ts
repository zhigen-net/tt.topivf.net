import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { ChangePasswordDto, CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto'
import { Roles } from '../auth/roles.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import type { User } from './user.entity'

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changeOwnPassword(@CurrentUser() me: User, @Body() dto: ChangePasswordDto) {
    return this.svc.changeOwnPassword(me.id, dto)
  }

  @Get()
  @Roles('admin')
  findAll() {
    return this.svc.findAll()
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateUserDto) {
    return this.svc.create(dto)
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.svc.update(id, dto)
  }

  @Patch(':id/password')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetPasswordDto) {
    return this.svc.resetPassword(id, dto.password)
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: User) {
    return this.svc.remove(id, me.id)
  }
}
