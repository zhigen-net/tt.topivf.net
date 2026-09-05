import {
  ArrayMaxSize, ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsOptional, IsUUID,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PLATFORMS, type Platform } from '../../accounts/account.entity'

export class CreateTaskDto {
  @ApiProperty()
  @IsUUID('4')
  contentId: string

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  accountIds: string[]

  @ApiPropertyOptional({ enum: PLATFORMS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(PLATFORMS, { each: true })
  platforms?: Platform[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string
}

export class BulkCreateTaskDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  contentIds: string[]

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  accountIds: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string
}
