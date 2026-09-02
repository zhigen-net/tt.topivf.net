import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { UsersService } from '../users/users.service'

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private users: UsersService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.users.findByUsername(username)
    // 用户名不存在时也走一次 compare，避免用响应快慢试探哪些用户名存在
    const ok = await bcrypt.compare(password, user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv')
    if (!user || !ok) throw new UnauthorizedException('用户名或密码不正确')
    if (!user.isActive) throw new UnauthorizedException('账号已停用')

    await this.users.touchLogin(user.id)
    return {
      token: this.jwt.sign({ sub: user.id, username: user.username, role: user.role }),
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    }
  }
}
