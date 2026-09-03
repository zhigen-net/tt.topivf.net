import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomBytes } from 'crypto'
import * as bcrypt from 'bcryptjs'
import { ApiKey } from './api-key.entity'
import { CreateApiKeyDto } from './dto/api-key.dto'
import { UsersService } from '../users/users.service'
import type { User } from '../users/user.entity'

const ROUNDS = 10
const PREFIX_LEN = 8
const SECRET_LEN = 32

export interface ResolvedKey {
  apiKey: ApiKey
  user: User
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey) private repo: Repository<ApiKey>,
    private readonly users: UsersService,
  ) {}

  findAll() {
    return this.repo.find({ relations: { user: true }, order: { createdAt: 'DESC' } })
  }

  /** 返回值里的 token 是唯一一次能拿到明文的机会 */
  async create(dto: CreateApiKeyDto): Promise<{ apiKey: ApiKey; token: string }> {
    const user = await this.users.findById(dto.userId)
    if (!user) throw new NotFoundException('绑定的用户不存在')
    if (!user.isActive) throw new BadRequestException('不能给已停用的用户创建密钥')

    const prefix = randomBytes(PREFIX_LEN / 2).toString('hex')
    const secret = randomBytes(SECRET_LEN / 2).toString('hex')

    const apiKey = await this.repo.save(this.repo.create({
      name: dto.name,
      prefix,
      secretHash: await bcrypt.hash(secret, ROUNDS),
      userId: dto.userId,
      scopes: dto.scopes,
      accountIds: dto.accountIds ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    }))

    apiKey.user = user
    return { apiKey, token: `sh_${prefix}${secret}` }
  }

  async revoke(id: string) {
    const key = await this.repo.findOneBy({ id })
    if (!key) throw new NotFoundException('密钥不存在')
    if (key.revokedAt) return key
    key.revokedAt = new Date()
    return this.repo.save(key)
  }

  async remove(id: string) {
    const res = await this.repo.delete(id)
    if (!res.affected) throw new NotFoundException('密钥不存在')
  }

  /** 校验失败一律返回 null，不区分原因，避免探测出哪一段是对的 */
  async resolve(token: string): Promise<ResolvedKey | null> {
    const raw = token.slice(3)
    if (raw.length !== PREFIX_LEN + SECRET_LEN) return null

    const key = await this.repo.findOne({
      where: { prefix: raw.slice(0, PREFIX_LEN) },
      relations: { user: true },
    })
    if (!key) return null
    if (key.revokedAt) return null
    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return null
    if (!await bcrypt.compare(raw.slice(PREFIX_LEN), key.secretHash)) return null
    if (!key.user?.isActive) return null

    // 只更新时间戳，不用 save，避免把整行连同 relations 写回去
    void this.repo.update(key.id, { lastUsedAt: new Date() })

    return { apiKey: key, user: key.user }
  }
}
