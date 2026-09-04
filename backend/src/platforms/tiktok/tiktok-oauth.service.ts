import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { randomBytes } from 'node:crypto'
import { Account } from '../../accounts/account.entity'
import { tiktokGet } from './tiktok-api'
import { buildAuthorizeUrl, exchangeCode, type TiktokTokens } from './tiktok-oauth'
import { TiktokTokenService } from './tiktok-token.service'

/** 授权链接的有效期。用户在 TikTok 那边磨蹭太久就让他重新点一次 */
const STATE_TTL_MS = 10 * 60 * 1000

interface PendingState {
  workspaceId: string
  expiresAt: number
}

interface UserInfo {
  open_id: string
  union_id?: string
  display_name?: string
  username?: string
  avatar_url?: string
  follower_count?: number
  following_count?: number
  video_count?: number
}

const USER_FIELDS = [
  'open_id', 'union_id', 'display_name', 'username', 'avatar_url',
  'follower_count', 'following_count', 'video_count',
].join(',')

@Injectable()
export class TiktokOauthService {
  private readonly logger = new Logger(TiktokOauthService.name)
  private readonly clientKey: string
  private readonly clientSecret: string
  private readonly redirectUri: string
  /**
   * state 只活十分钟且用完即删，放内存足够。存库反而要为一个短命的随机串
   * 加一张表，重启丢掉的代价只是用户重点一次授权按钮。
   */
  private readonly pending = new Map<string, PendingState>()

  constructor(
    cfg: ConfigService,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly tokens: TiktokTokenService,
  ) {
    this.clientKey = cfg.get<string>('TIKTOK_CLIENT_KEY') ?? ''
    this.clientSecret = cfg.get<string>('TIKTOK_CLIENT_SECRET') ?? ''
    const base = (cfg.get<string>('PUBLIC_API_URL') ?? '').replace(/\/$/, '')
    this.redirectUri = cfg.get<string>('TIKTOK_REDIRECT_URI')
      || `${base}/v1/tiktok/oauth/callback`
  }

  /** 生成授权链接，前端把它开在新窗口里 */
  start(workspaceId: string): { url: string } {
    this.tokens.assertConfigured()
    if (!this.redirectUri.startsWith('http')) {
      throw new BadRequestException('未配置 TIKTOK_REDIRECT_URI 或 PUBLIC_API_URL')
    }
    this.sweep()

    const state = randomBytes(24).toString('base64url')
    this.pending.set(state, { workspaceId, expiresAt: Date.now() + STATE_TTL_MS })
    return { url: buildAuthorizeUrl(this.clientKey, this.redirectUri, state) }
  }

  /** TikTok 回调过来的 code 换令牌，然后建号或更新已有的号 */
  async complete(code: string, state: string) {
    this.sweep()
    const entry = this.pending.get(state)
    // 一次性：即便后面失败也不许重放，重来就重新点授权
    this.pending.delete(state)
    if (!entry) throw new BadRequestException('授权链接已过期，请重新发起授权')

    const tokens = await exchangeCode(this.clientKey, this.clientSecret, code, this.redirectUri)
    const info = await this.fetchUserInfo(tokens.accessToken)
    const account = await this.upsertAccount(entry.workspaceId, tokens, info)

    this.logger.log(`TikTok 官方授权完成: @${account.username} (${tokens.scopes.join(',')})`)
    return { accountId: account.id, username: account.username, scopes: tokens.scopes }
  }

  private async fetchUserInfo(token: string): Promise<UserInfo> {
    const res = await tiktokGet<{ user: UserInfo }>('/user/info/', { fields: USER_FIELDS }, token)
    if (!res.user?.open_id) throw new BadRequestException('无法读取 TikTok 账号信息')
    return res.user
  }

  /**
   * 同一个 TikTok 账号可能之前用浏览器方式接过。按 open_id 匹配到就升级成官方授权，
   * 保留原有的分组、代理和历史发布记录。
   */
  private async upsertAccount(workspaceId: string, tokens: TiktokTokens, info: UserInfo) {
    const existing = await this.accounts.findOne({
      where: { workspaceId, platform: 'tiktok', externalId: info.open_id },
    })
    const account = existing ?? this.accounts.create({
      workspaceId,
      platform: 'tiktok',
      externalId: info.open_id,
    })

    account.username = info.username || info.display_name || info.open_id
    account.displayName = info.display_name || account.username
    account.avatar = info.avatar_url
    account.followers = info.follower_count ?? 0
    account.following = info.following_count ?? 0
    account.postsCount = info.video_count ?? 0
    account.status = 'active'
    account.lastActiveAt = new Date()
    account.sessionData = { ...account.sessionData, tiktok: this.tokens.toSession(tokens) }

    return this.accounts.save(account)
  }

  private sweep() {
    const now = Date.now()
    for (const [key, v] of this.pending) {
      if (v.expiresAt <= now) this.pending.delete(key)
    }
  }
}
