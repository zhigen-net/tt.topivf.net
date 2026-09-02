import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { IS_PUBLIC_KEY } from './public.decorator'
import { UsersService } from '../users/users.service'
import type { User } from '../users/user.entity'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<Request & { user?: User }>()
    const [scheme, token] = req.headers.authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token')

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
