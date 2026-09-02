import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ContentsService } from './contents.service'
import { CreateContentDto } from './dto/create-content.dto'
import { UpdateContentDto } from './dto/update-content.dto'
import { QueryContentsDto } from './dto/query-contents.dto'
import { BulkIdsDto, BulkPlatformsDto } from './dto/bulk-contents.dto'
import { BulkReviewDto, ReviewContentDto } from './dto/review-content.dto'
import { Roles } from '../auth/roles.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import type { User } from '../users/user.entity'

@ApiTags('contents')
@ApiBearerAuth()
@Controller('contents')
export class ContentsController {
  constructor(private readonly svc: ContentsService) {}

  @Get()
  findAll(@Query() query: QueryContentsDto) {
    return this.svc.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateContentDto, @CurrentUser() me: User) {
    return this.svc.create(dto, me)
  }

  // 批量操作走 POST 子路径，否则会被 :id 上的 ParseUUIDPipe 拦掉
  @Post('bulk-delete')
  bulkRemove(@Body() dto: BulkIdsDto, @CurrentUser() me: User) {
    return this.svc.bulkRemove(dto.ids, me)
  }

  @Post('bulk-platforms')
  bulkSetPlatforms(@Body() dto: BulkPlatformsDto, @CurrentUser() me: User) {
    return this.svc.bulkSetPlatforms(dto.ids, dto.platforms, me)
  }

  @Post('bulk-submit')
  bulkSubmit(@Body() dto: BulkIdsDto, @CurrentUser() me: User) {
    return this.svc.bulkSubmit(dto.ids, me)
  }

  @Post('bulk-review')
  @Roles('admin')
  bulkReview(@Body() dto: BulkReviewDto, @CurrentUser() me: User) {
    return this.svc.bulkReview(dto.ids, dto.action, dto.note, me)
  }

  @Post(':id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: User) {
    return this.svc.submit(id, me)
  }

  @Post(':id/review')
  @Roles('admin')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewContentDto,
    @CurrentUser() me: User,
  ) {
    return this.svc.review(id, dto.action, dto.note, me)
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContentDto, @CurrentUser() me: User) {
    return this.svc.update(id, dto, me)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() me: User) {
    return this.svc.remove(id, me)
  }
}
