import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PLATFORMS, type Platform } from '../../accounts/account.entity'

export const COMMENT_STATUSES = ['pending', 'replied', 'ignored', 'all'] as const
export type CommentStatus = (typeof COMMENT_STATUSES)[number]

export class QueryCommentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string

  @ApiPropertyOptional({ enum: PLATFORMS })
  @IsOptional()
  @IsEnum(PLATFORMS)
  platform?: Platform

  @ApiPropertyOptional({ enum: COMMENT_STATUSES })
  @IsOptional()
  @IsEnum(COMMENT_STATUSES)
  status?: CommentStatus

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string

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
