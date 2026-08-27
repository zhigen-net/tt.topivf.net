import { Controller, Post, Get, Delete, Param, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { TiktokLoginService } from './tiktok-login.service'

@ApiTags('tiktok-login')
@ApiBearerAuth()
@Controller('tiktok/login-session')
export class TiktokLoginController {
  constructor(private readonly svc: TiktokLoginService) {}

  @Post()
  startSession() {
    return this.svc.startSession()
  }

  @Get(':id')
  getStatus(@Param('id') id: string) {
    return this.svc.getSessionStatus(id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelSession(@Param('id') id: string) {
    return this.svc.cancelSession(id)
  }
}
