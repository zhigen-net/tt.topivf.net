import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { randomBytes } from 'crypto'
import * as bcrypt from 'bcryptjs'
import { ApiKey } from './api-key.entity'
import { CreateApiKeyDto } from './dto/api-key.dto'
import { Account } from '../accounts/account.entity'
import type { User } from '../users/user.entity'
import type { WorkspaceContext } from '../workspaces/workspace-context'

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
    @InjectRepository(Account) private accounts: Repository<Account>,
  ) {}

  findAll(ws: WorkspaceContext, actor: User) {
    return this.repo.find({
      where: this.scope(ws, actor),
      relations: { user: true },
      order: { createdAt: 'DESC' },
    })
  }

  /** 返回值里的 token 是唯一一次能拿到明文的机会 */
  async create(dto: CreateApiKeyDto, ws: WorkspaceContext, actor: User) {
    await this.assertAccountsInWorkspace(dto.accountIds, ws.id)

    const prefix = randomBytes(PREFIX_LEN / 2).toString('hex')
    const secret = randomBytes(SECRET_LEN / 2).toString('hex')

    const apiKey = await this.repo.save(this.repo.create({
      name: dto.name,
      prefix,
      secretHash: await bcrypt.hash(secret, ROUNDS),
      // 空间与签发人都取自当前请求，不接受客户端指定
      workspaceId: ws.id,
      userId: actor.id,
      scopes: dto.scopes,
      accountIds: dto.accountIds ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    }))

    apiKey.user = actor
    return { apiKey, token: `sh_${prefix}${secret}` }
  }

  async revoke(id: string, ws: WorkspaceContext, actor: User) {
    const key = await this.findOwned(id, ws, actor)
    if (key.revokedAt) return key
    key.revokedAt = new Date()
    return this.repo.save(key)
  }

  async remove(id: string, ws: WorkspaceContext, actor: User) {
    const key = await this.findOwned(id, ws, actor)
    await this.repo.delete(key.id)
  }

  /** member 只管得着自己签发的密钥，否则同事之间能互相废掉对方的自动化 */
  private scope(ws: WorkspaceContext, actor: User) {
    return ws.role === 'manager'
      ? { workspaceId: ws.id }
      : { workspaceId: ws.id, userId: actor.id }
  }

  private async findOwned(id: string, ws: WorkspaceContext, actor: User) {
    const key = await this.repo.findOneBy({ id, ...this.scope(ws, actor) })
    if (!key) throw new NotFoundException('密钥不存在')
    return key
  }

  private async assertAccountsInWorkspace(ids: string[] | null | undefined, workspaceId: string) {
    if (!ids?.length) return
    const unique = [...new Set(ids)]
    const found = await this.accounts.countBy({ id: In(unique), workspaceId })
    if (found !== unique.length) {
      throw new NotFoundException('部分账号不存在或不属于当前工作空间')
    }
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
