import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PLATFORMS } from '../../contents/dto/create-content.dto'
import { ACCOUNT_STATUSES } from './update-account.dto'
import type { AccountStatus, Platform } from '../account.entity'

export class QueryAccountsDto {
  @ApiPropertyOptional({ enum: PLATFORMS })
  @IsOptional()
  @IsEnum(PLATFORMS)
  platform?: Platform

  @ApiPropertyOptional({ enum: ACCOUNT_STATUSES })
  @IsOptional()
  @IsEnum(ACCOUNT_STATUSES)
  status?: AccountStatus

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

  // 发布对话框要一次列出全部账号来做选择，上限比列表页宽
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number
}
