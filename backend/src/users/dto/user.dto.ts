import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger'
import type { UserRole } from '../user.entity'

export const USER_ROLES = ['admin', 'user'] as const

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
  @MaxLength(72) // bcrypt 只取前 72 字节，再长的部分静默失效
  password: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  displayName: string

  @ApiProperty({ description: '登录邮箱' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(255)
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
  @MaxLength(255)
  email: string
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string
}

export class ChangePasswordDto extends ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(72)
  currentPassword: string
}
