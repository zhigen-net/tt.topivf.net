import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PLATFORMS, type Platform } from '../../accounts/account.entity'

/** 只允许按这几列排，直接拼用户传进来的列名就是注入 */
export const POST_SORTS = ['publishedAt', 'views', 'likes', 'comments', 'shares'] as const
export type PostSort = (typeof POST_SORTS)[number]

export class QueryPostsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string

  @ApiPropertyOptional({ enum: PLATFORMS })
  @IsOptional()
  @IsEnum(PLATFORMS)
  platform?: Platform

  @ApiPropertyOptional({ enum: POST_SORTS })
  @IsOptional()
  @IsEnum(POST_SORTS)
  sort?: PostSort

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number
}
