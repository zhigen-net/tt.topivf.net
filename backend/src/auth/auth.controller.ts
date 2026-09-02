import { Controller, Post, Get, Body } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { Public } from './public.decorator'
import { LoginDto } from './dto/login.dto'
import { CurrentUser } from './current-user.decorator'
import type { User } from '../users/user.entity'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly svc: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.svc.login(dto.username, dto.password)
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: User) {
    return user
  }
}
