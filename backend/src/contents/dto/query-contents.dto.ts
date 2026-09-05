import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { CONTENT_TYPES } from './create-content.dto'
import { REVIEW_STATUSES } from './review-content.dto'
import type { ContentType, ReviewStatus } from '../content.entity'
import { PLATFORMS, type Platform } from '../../accounts/account.entity'

export const SORT_FIELDS = ['createdAt', 'updatedAt', 'title', 'type'] as const
export type SortField = (typeof SORT_FIELDS)[number]

export class QueryContentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string

  @ApiPropertyOptional({ enum: CONTENT_TYPES })
  @IsOptional()
  @IsEnum(CONTENT_TYPES)
  type?: ContentType

  @ApiPropertyOptional({ enum: PLATFORMS })
  @IsOptional()
  @IsEnum(PLATFORMS)
  platform?: Platform

  @ApiPropertyOptional({ enum: REVIEW_STATUSES })
  @IsOptional()
  @IsEnum(REVIEW_STATUSES)
  reviewStatus?: ReviewStatus

  // 这个值会拼进 ORDER BY，白名单是唯一挡住注入的东西
  @ApiPropertyOptional({ enum: SORT_FIELDS })
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort?: SortField

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC'

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
  @Max(100)
  limit?: number
}
