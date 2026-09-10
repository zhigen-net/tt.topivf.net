import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { Platform } from '../account.entity'

export class CreateAccountDto {
  @ApiProperty({ enum: ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook'] })
  @IsEnum(['tiktok', 'instagram', 'youtube', 'twitter', 'facebook'])
  platform: Platform

  @ApiProperty()
  @IsString()
  username: string

  @ApiProperty()
  @IsString()
  displayName: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  proxyId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string

  @ApiPropertyOptional({ description: '给 AI 的更新说明/要求，会被拼进 MCP 写类工具的描述里' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  brief?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sessionData?: Record<string, unknown>
}
