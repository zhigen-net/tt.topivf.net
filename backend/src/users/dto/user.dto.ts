import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger'
import type { UserRole } from '../user.entity'

export const USER_ROLES = ['admin', 'user'] as const

/** 表单清空邮箱时提交的是空串，落库要变成 null，否则第二个空串会撞唯一索引 */
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && !value.trim() ? null : value))

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

  @ApiPropertyOptional({ nullable: true, description: '可选，填了就能用邮箱登录' })
  @IsOptional()
  @blankToNull()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(255)
  email?: string | null

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @blankToNull()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(255)
  email?: string | null
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
