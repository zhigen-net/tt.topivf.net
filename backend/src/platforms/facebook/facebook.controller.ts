import { Body, Controller, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FacebookService } from './facebook.service'
import { ListPagesDto } from './dto/list-pages.dto'

@ApiTags('facebook')
@ApiBearerAuth()
@Controller('facebook')
export class FacebookController {
  constructor(private readonly svc: FacebookService) {}

  @Post('pages')
  listPages(@Body() dto: ListPagesDto) {
    return this.svc.listPages(dto.token)
  }
}
