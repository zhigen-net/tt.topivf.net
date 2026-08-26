import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'
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
}
