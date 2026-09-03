import {
  ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { MCP_SCOPES, type McpScope } from '../api-key.entity'

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  name: string

  @ApiProperty({ description: '这把 key 以哪个用户的身份操作' })
  @IsUUID()
  userId: string

  @ApiProperty({ enum: MCP_SCOPES, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(MCP_SCOPES, { each: true })
  scopes: McpScope[]

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    description: '限定可操作的社交账号；不传或 null 表示不限',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  accountIds?: string[] | null

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null
}
