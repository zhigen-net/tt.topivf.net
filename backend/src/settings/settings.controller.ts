import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SettingsService } from './settings.service'
import { UpdateSettingsDto } from './dto/settings.dto'
import { Public } from '../auth/public.decorator'
import { Roles } from '../auth/roles.decorator'

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  /**
   * 登录页要用站点名字，所以这里免鉴权。返回值逐字段手写，
   * 以后加的配置项默认不在这条路上——想公开必须自己加进来。
   */
  @Public()
  @Get()
  async find() {
    const s = await this.svc.get()
    return { siteName: s.siteName }
  }

  @Patch()
  @Roles('admin')
  @ApiBearerAuth()
  async update(@Body() dto: UpdateSettingsDto) {
    const s = await this.svc.update(dto)
    return { siteName: s.siteName }
  }
}
