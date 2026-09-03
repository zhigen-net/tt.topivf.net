import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { PartialType } from '@nestjs/swagger'

export class CreateProxyDto {
  @IsString()
  @MaxLength(255)
  host: string

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number

  @IsOptional()
  @IsIn(['http', 'socks5'])
  protocol?: 'http' | 'socks5'

  @IsOptional()
  @IsString()
  @MaxLength(128)
  username?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string

  @IsOptional()
  @IsBoolean()
  isHealthy?: boolean
}

export class UpdateProxyDto extends PartialType(CreateProxyDto) {}
