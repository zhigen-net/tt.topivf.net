import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { WorkspacesService } from './workspaces.service'
import {
  WORKSPACE_HEADER, WORKSPACE_ROLE_KEY, atLeast,
  type WorkspaceContext, type WorkspaceRequirement,
} from './workspace-context'
import type { AuthRequest } from '../auth/auth-request'

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspaces: WorkspacesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<WorkspaceRequirement>(WORKSPACE_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    const req = context.switchToHttp().getRequest<AuthRequest>()
    if (!req.user) return !required

    req.workspace = await this.resolve(req, required?.param)
    if (!required) return true

    if (!req.workspace) throw new ForbiddenException('请先选择工作空间')
    if (!atLeast(req.workspace.role, required.role)) {
      throw new ForbiddenException('当前空间角色不足以执行该操作')
    }
    return true
  }

  private async resolve(req: AuthRequest, param?: string): Promise<WorkspaceContext | undefined> {
    const user = req.user!

    // MCP 走密钥，空间在签发时就钉死了，不接受客户端指定
    if (req.apiKey) {
      if (!req.apiKey.workspaceId) return undefined
      const role = await this.workspaces.resolveRole(req.apiKey.workspaceId, user)
      return role ? { id: req.apiKey.workspaceId, role } : undefined
    }

    const raw = param ? req.params?.[param] : req.headers[WORKSPACE_HEADER]
    const requested = Array.isArray(raw) ? raw[0] : raw

    if (requested) {
      const role = await this.workspaces.resolveRole(requested, user)
      // 明确指定了却没权限就是越权，不能悄悄退回到默认空间
      if (!role) throw new ForbiddenException('无权访问该工作空间')
      return { id: requested, role }
    }

    // 没带头部时退回到第一个可见空间，让老客户端和 Swagger 仍能用
    const [first] = await this.workspaces.findVisible(user)
    if (!first) return undefined
    const role = await this.workspaces.resolveRole(first.id, user)
    return role ? { id: first.id, role } : undefined
  }
}
