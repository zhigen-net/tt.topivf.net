import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { WorkspaceRole } from './workspace-member.entity'
import type { AuthRequest } from '../auth/auth-request'

export interface WorkspaceContext {
  id: string
  role: WorkspaceRole
}

/** 数值越大权限越高，用于「至少 X 角色」的比较 */
const RANK: Record<WorkspaceRole, number> = { viewer: 1, member: 2, manager: 3 }

export const atLeast = (role: WorkspaceRole, required: WorkspaceRole) =>
  RANK[role] >= RANK[required]

export const WORKSPACE_ROLE_KEY = 'workspaceMinRole'

export interface WorkspaceRequirement {
  role: WorkspaceRole
  /** 从路径参数取空间 id 而不是请求头，用于 /workspaces/:id/* 这类路由 */
  param?: string
}

/** 标了这个装饰器的路由才强制要求空间上下文，没标的（登录、用户管理等）不受影响 */
export const MinWorkspaceRole = (role: WorkspaceRole, param?: string) =>
  SetMetadata<string, WorkspaceRequirement>(WORKSPACE_ROLE_KEY, { role, param })

export const CurrentWorkspace = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthRequest>().workspace
})

export const WORKSPACE_HEADER = 'x-workspace-id'
