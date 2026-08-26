import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

const ADMIN_USER = { id: '1', username: 'admin', password: process.env.ADMIN_PASSWORD ?? 'admin123' }

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}

  async login(username: string, password: string) {
    if (username !== ADMIN_USER.username || password !== ADMIN_USER.password) {
      throw new UnauthorizedException('Invalid credentials')
    }
    const token = this.jwt.sign({ sub: ADMIN_USER.id, username })
    return { token, user: { id: ADMIN_USER.id, username } }
  }

  verify(token: string) { return this.jwt.verify(token) }
}
