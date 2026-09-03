import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'
import { WORKSPACE_ROLES, type WorkspaceRole } from '../workspace-member.entity'

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string
}

export class UpdateWorkspaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string
}

export class AddMemberDto {
  @IsUUID()
  userId: string

  @IsIn(WORKSPACE_ROLES)
  role: WorkspaceRole
}

export class UpdateMemberDto {
  @IsIn(WORKSPACE_ROLES)
  role: WorkspaceRole
}

export class SearchUsersDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  search: string
}
