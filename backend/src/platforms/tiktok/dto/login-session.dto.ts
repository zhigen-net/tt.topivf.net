import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class StartLoginSessionDto {
  @ApiPropertyOptional({ enum: ['qr', 'password'], default: 'password' })
  @IsOptional()
  @IsEnum(['qr', 'password'])
  method?: 'qr' | 'password'

  /** 邮箱、手机号或 TikTok 用户名 */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  identifier?: string

  /** 只用于填表，不落库也不写日志 */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string
}

export class LoginInputDto {
  @ApiProperty({ enum: ['click', 'type', 'key', 'scroll'] })
  @IsEnum(['click', 'type', 'key', 'scroll'])
  type: 'click' | 'type' | 'key' | 'scroll'

  /** click 的坐标，相对于远程画面左上角的 CSS 像素 */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  x?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  y?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  deltaY?: number

  /** type 的文本，或 key 的按键名（Enter/Backspace/Tab…） */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string
}
