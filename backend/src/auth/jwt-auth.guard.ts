import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_PUBLIC_KEY } from './public.decorator'
import { ApiKeysService } from './api-keys.service'
import { UsersService } from '../users/users.service'
import type { AuthRequest } from './auth-request'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly users: UsersService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<AuthRequest>()
    const [scheme, token] = req.headers.authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token')

    if (token.startsWith('sh_')) {
      const resolved = await this.apiKeys.resolve(token)
      if (!resolved) throw new UnauthorizedException('API Key 无效、已吊销或已过期')
      req.user = resolved.user
      req.apiKey = resolved.apiKey
      return true
    }

    let sub: string
    try {
      sub = this.jwt.verify<{ sub: string }>(token).sub
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }

    // 每次都读库：改角色、停用账号才能立刻生效，不用等 token 过期
    const user = await this.users.findById(sub)
    if (!user?.isActive) throw new UnauthorizedException('账号不存在或已停用')

    req.user = user
    return true
  }
}
