import { Controller, Get, Param } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AnalyticsService } from './analytics.service'

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('accounts/:id')
  getByAccount(@Param('id') id: string) { return this.svc.getByAccount(id) }
}
