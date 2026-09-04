import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Account } from '../../accounts/account.entity'
import { SecretBox } from '../../crypto/secret-box'
import { TiktokApiError } from './tiktok-api'
import { refreshTokens, type TiktokTokens } from './tiktok-oauth'

/** 存进 sessionData.tiktok 的形状，两个令牌都是密文 */
export interface TiktokSession {
  openId: string
  encryptedAccessToken: string
  encryptedRefreshToken: string
  scopes: string[]
  expiresAt: number
  refreshExpiresAt: number
}

/** 提前这么久就换新的，避免发布跑到一半令牌过期 */
const REFRESH_MARGIN_MS = 10 * 60 * 1000

export function readSession(account: Account): TiktokSession | null {
  const raw = account.sessionData?.tiktok as TiktokSession | undefined
  return raw?.encryptedRefreshToken ? raw : null
}

@Injectable()
export class TiktokTokenService {
  private readonly logger = new Logger(TiktokTokenService.name)
  private readonly clientKey: string
  private readonly clientSecret: string

  constructor(
    cfg: ConfigService,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly secrets: SecretBox,
  ) {
    this.clientKey = cfg.get<string>('TIKTOK_CLIENT_KEY') ?? ''
    this.clientSecret = cfg.get<string>('TIKTOK_CLIENT_SECRET') ?? ''
  }

  get configured(): boolean {
    return Boolean(this.clientKey && this.clientSecret && this.secrets.enabled)
  }

  assertConfigured() {
    if (!this.clientKey || !this.clientSecret) {
      throw new BadRequestException('未配置 TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET')
    }
    if (!this.secrets.enabled) {
      throw new BadRequestException('未配置 CREDENTIAL_ENCRYPTION_KEY，无法安全保存 TikTok 授权')
    }
  }

  toSession(tokens: TiktokTokens): TiktokSession {
    this.assertConfigured()
    return {
      openId: tokens.openId,
      encryptedAccessToken: this.secrets.encrypt(tokens.accessToken),
      encryptedRefreshToken: this.secrets.encrypt(tokens.refreshToken),
      scopes: tokens.scopes,
      expiresAt: tokens.expiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
    }
  }

  /**
   * 取一条一定能用的 access token。访问令牌只有 24 小时，快到期就先换一轮，
   * 换出来的新 refresh token 必须立刻落库——TikTok 是轮换式的，旧的换完就废了。
   */
  async freshAccessToken(account: Account): Promise<{ token: string; scopes: string[] }> {
    const session = readSession(account)
    if (!session) throw new TiktokApiError('access_token_invalid', '账号未完成 TikTok 官方授权')
    this.assertConfigured()

    if (Date.now() < session.expiresAt - REFRESH_MARGIN_MS) {
      return { token: this.secrets.decrypt(session.encryptedAccessToken), scopes: session.scopes }
    }
    if (Date.now() >= session.refreshExpiresAt) {
      throw new TiktokApiError('refresh_token_expired', 'TikTok 授权已过期，请重新授权')
    }

    const refreshed = await refreshTokens(
      this.clientKey, this.clientSecret, this.secrets.decrypt(session.encryptedRefreshToken),
    )
    await this.save(account, refreshed)
    this.logger.log(`已刷新 TikTok 令牌: @${account.username}`)
    return { token: refreshed.accessToken, scopes: refreshed.scopes }
  }

  async save(account: Account, tokens: TiktokTokens) {
    const session = this.toSession(tokens)
    account.sessionData = { ...account.sessionData, tiktok: session }
    await this.accounts.save({ id: account.id, sessionData: account.sessionData })
    return session
  }
}
