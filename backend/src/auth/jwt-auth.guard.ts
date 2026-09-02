import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { IS_PUBLIC_KEY } from './public.decorator'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<Request>()
    const [scheme, token] = req.headers.authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token')

    try {
      ;(req as Request & { user?: unknown }).user = this.jwt.verify(token)
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
    return true
  }
}
