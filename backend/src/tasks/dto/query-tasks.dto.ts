import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class QueryTasksDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  accountId?: string

  @ApiPropertyOptional({ description: '按作品标题搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  contentId?: string

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
