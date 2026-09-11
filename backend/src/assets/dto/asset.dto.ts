import {
  IsBooleanString, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min,
} from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { PLATFORMS, type Platform } from '../../accounts/account.entity'
import type { AssetType } from '../asset.entity'

export const ASSET_TYPES = ['video', 'image'] as const
export const ASSET_SORTS = ['createdAt', 'size', 'filename'] as const
export type AssetSort = (typeof ASSET_SORTS)[number]

export class ShareAssetDto {
  @ApiPropertyOptional({ description: '链接有效天数，不填按默认值' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number
}

export class QueryAssetsDto {
  @ApiPropertyOptional({ enum: ASSET_TYPES })
  @IsOptional()
  @IsIn(ASSET_TYPES)
  type?: AssetType

  @ApiPropertyOptional({ description: 'true 只看被作品引用的，false 只看没被引用的' })
  @IsOptional()
  @IsBooleanString()
  referenced?: string

  @ApiPropertyOptional({ description: 'true 只看发布过的，false 只看从没发布过的' })
  @IsOptional()
  @IsBooleanString()
  published?: string

  @ApiPropertyOptional({ description: '只看发布到过这些账号的素材，逗号分隔' })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : String(value).split(',')).filter(Boolean))
  @IsUUID(undefined, { each: true })
  accountIds?: string[]

  @ApiPropertyOptional({ enum: PLATFORMS, description: '只看发布到过这个平台的素材' })
  @IsOptional()
  @IsIn(PLATFORMS)
  platform?: Platform

  @ApiPropertyOptional({ description: '上传者用户 id' })
  @IsOptional()
  @IsUUID()
  uploadedById?: string

  @ApiPropertyOptional({ description: '上传时间下界，含当天' })
  @IsOptional()
  @IsDateString()
  from?: string

  @ApiPropertyOptional({ description: '上传时间上界，含当天' })
  @IsOptional()
  @IsDateString()
  to?: string

  @ApiPropertyOptional({ enum: ASSET_SORTS })
  @IsOptional()
  @IsIn(ASSET_SORTS)
  sort?: AssetSort

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase())
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC'

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
  @Max(100)
  limit?: number
}
