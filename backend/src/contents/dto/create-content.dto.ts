import {
  ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl, IsUUID, MaxLength, Min,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { ContentType } from '../content.entity'
import type { Platform } from '../../accounts/account.entity'

export const CONTENT_TYPES = ['video', 'image', 'reel', 'story'] as const
export const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook'] as const

// 平台侧是自己去拉这个地址的，内网地址拉不到，但也不该在这里限制得比平台还死
const URL_RULES = { protocols: ['http', 'https'], require_protocol: true, require_tld: false }

export class CreateContentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string

  @ApiProperty({ enum: CONTENT_TYPES })
  @IsEnum(CONTENT_TYPES)
  type: ContentType

  // 这三个字段传 null 表示「清空」，@IsOptional 对 null 会跳过校验
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(URL_RULES)
  fileUrl?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(URL_RULES)
  thumbnailUrl?: string | null

  // 素材库引用。与上面的外链二选一，存量作品全是外链，两条路都要留着
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  assetId?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  thumbnailAssetId?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  caption?: string | null

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  hashtags?: string[]

  @ApiProperty({ enum: PLATFORMS, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(PLATFORMS, { each: true })
  platforms: Platform[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number
}
