import {
  IsBoolean, IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID,
  Matches, MaxLength, MinLength, ValidateIf,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger'
import { MaxBytes } from './max-bytes.validator'
import type { UserRole } from '../user.entity'
import { WORKSPACE_ROLES, type WorkspaceRole } from '../../workspaces/workspace-member.entity'

export const USER_ROLES = ['admin', 'user'] as const

export const WORKSPACE_MODES = ['join', 'create', 'none'] as const
export type WorkspaceMode = (typeof WORKSPACE_MODES)[number]

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

  @ApiPropertyOptional({ enum: WORKSPACE_MODES, description: '不传按 none 处理' })
  @IsOptional()
  @IsIn(WORKSPACE_MODES)
  workspaceMode?: WorkspaceMode

  @ApiPropertyOptional({ description: 'workspaceMode=join 时必填' })
  @ValidateIf((o: CreateUserDto) => o.workspaceMode === 'join')
  @IsUUID()
  workspaceId?: string

  @ApiPropertyOptional({ enum: WORKSPACE_ROLES, description: 'workspaceMode=join 时的角色，默认 member' })
  @ValidateIf((o: CreateUserDto) => o.workspaceMode === 'join' && o.workspaceRole !== undefined)
  @IsIn(WORKSPACE_ROLES)
  workspaceRole?: WorkspaceRole

  @ApiPropertyOptional({ description: 'workspaceMode=create 时必填' })
  @ValidateIf((o: CreateUserDto) => o.workspaceMode === 'create')
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  workspaceName?: string
}

/**
 * 空间归属只在建号那一刻处理，改归属是「迁移」语义（要退旧空间、判唯一管理员、
 * 作废 MCP 密钥），走工作空间管理页。不 Omit 掉的话这几个字段会被 PATCH 悄悄收下
 * 再被 Object.assign 丢弃，调用方以为改了其实没有。
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, [
    'username', 'password',
    'workspaceMode', 'workspaceId', 'workspaceRole', 'workspaceName',
  ] as const),
) {
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
