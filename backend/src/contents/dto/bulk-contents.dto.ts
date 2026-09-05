import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { PLATFORMS, type Platform } from '../../accounts/account.entity'

export class BulkIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids: string[]
}

export class BulkPlatformsDto extends BulkIdsDto {
  @ApiProperty({ enum: PLATFORMS, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(PLATFORMS, { each: true })
  platforms: Platform[]
}
