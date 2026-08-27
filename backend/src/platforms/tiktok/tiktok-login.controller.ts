import { Controller, Post, Get, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { TiktokLoginService } from './tiktok-login.service'
import { LoginInputDto, StartLoginSessionDto } from './dto/login-session.dto'

@ApiTags('tiktok-login')
@ApiBearerAuth()
@Controller('tiktok/login-session')
export class TiktokLoginController {
  constructor(private readonly svc: TiktokLoginService) {}

  @Post()
  startSession(@Body() dto: StartLoginSessionDto) {
    return this.svc.startSession(dto)
  }

  @Get(':id')
  getStatus(@Param('id') id: string) {
    return this.svc.getSessionStatus(id)
  }

  @Get(':id/screen')
  getScreen(@Param('id') id: string) {
    return this.svc.getScreen(id)
  }

  @Post(':id/input')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendInput(@Param('id') id: string, @Body() input: LoginInputDto) {
    return this.svc.sendInput(id, input)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelSession(@Param('id') id: string) {
    return this.svc.cancelSession(id)
  }
}
