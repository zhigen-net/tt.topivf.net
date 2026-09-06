import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger'
import { MaxBytes } from './max-bytes.validator'
import type { UserRole } from '../user.entity'

export const USER_ROLES = ['admin', 'user'] as const

const PASSWORD_MAX_BYTES = 72
const PASSWORD_TOO_LONG = '密码过长：bcrypt 只认前 72 字节，一个汉字占 3 字节'

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: '用户名只能包含字母、数字、下划线、点和短横线' })
  username: string

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxBytes(PASSWORD_MAX_BYTES, { message: PASSWORD_TOO_LONG })
  password: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName: string

  @ApiProperty({ description: '登录邮箱' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(255, { message: '邮箱不能超过 255 个字符' })
  email: string

  @ApiPropertyOptional({ enum: USER_ROLES })
  @IsOptional()
  @IsEnum(USER_ROLES)
  role?: UserRole
}

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['username', 'password'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class UpdateProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName: string

  @ApiProperty({ description: '登录邮箱' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(255, { message: '邮箱不能超过 255 个字符' })
  email: string
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxBytes(PASSWORD_MAX_BYTES, { message: PASSWORD_TOO_LONG })
  password: string
}

export class ChangePasswordDto extends ResetPasswordDto {
  /**
   * 这里**不能**跟着收紧成按字节校验。老用户的密码可能超过 72 字节，
   * 当初是被 bcrypt 截断后存下的、至今能正常登录；改成字节校验会让他们
   * 连旧密码都填不进来，等于把人锁在门外还改不了密码。同理见 login.dto.ts。
   */
  @ApiProperty()
  @IsString()
  @MaxLength(72)
  currentPassword: string
}
