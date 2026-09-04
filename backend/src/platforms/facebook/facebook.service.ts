import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { graphGet, GraphError } from './graph-api'
import { exchangeForLongLived, inspectToken, type TokenInfo } from './token'

export interface LinkableInstagram {
  igUserId: string
  username: string
  avatar?: string
  followers: number
  postsCount: number
}

export interface LinkablePage {
  pageId: string
  name: string
  avatar?: string
  followers: number
  accessToken: string
  /** 该主页关联的 Instagram 专业账号，没关联就没有 */
  instagram?: LinkableInstagram
}

export interface LinkablePagesResult {
  pages: LinkablePage[]
  tokenType: string
  /** 主页凭证的有效期，unix 秒；0 表示永不过期 */
  expiresAt: number
  /** 是否替用户把短期令牌换成了长期令牌 */
  exchanged: boolean
}

interface AccountsEdge {
  data: Array<{
    id: string
    name: string
    access_token?: string
    followers_count?: number
    fan_count?: number
    picture?: { data?: { url?: string } }
    tasks?: string[]
    instagram_business_account?: {
      id: string
      username?: string
      profile_picture_url?: string
      followers_count?: number
      media_count?: number
    }
  }>
}

const PAGE_FIELDS = 'id,name,access_token,followers_count,fan_count,picture,tasks'
const IG_FIELDS =
  'instagram_business_account{id,username,profile_picture_url,followers_count,media_count}'

// 只列发布链路真正跑不动的那两个：缺 pages_read_engagement 只是读不到粉丝数和
// 转码状态，适配器本来就能降级，不该因此把令牌挡在门外
const REQUIRED_SCOPES = ['pages_show_list', 'pages_manage_posts']

// 短期令牌 1~2 小时，长期令牌 60 天，拿一周做界足够把两者分开
const SHORT_LIVED_MAX_MS = 7 * 24 * 60 * 60 * 1000

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name)
  private readonly appId: string
  private readonly appSecret: string

  constructor(cfg: ConfigService) {
    this.appId = cfg.get<string>('FACEBOOK_APP_ID') ?? ''
    this.appSecret = cfg.get<string>('FACEBOOK_APP_SECRET') ?? ''
  }

  async listPages(input: string): Promise<LinkablePagesResult> {
    const info = await friendly(() => inspectToken(input), '校验令牌')
    assertUsable(info)

    const { token, expiresAt, exchanged } = await this.ensureLongLived(input, info)
    const pages = await this.fetchPages(token)

    this.logger.log(
      `Listed ${pages.length} linkable page(s) from ${info.type} token` +
        (exchanged ? ' (exchanged for long-lived)' : ''),
    )
    return { pages, tokenType: info.type, expiresAt, exchanged }
  }

  private async ensureLongLived(token: string, info: TokenInfo) {
    const asIs = { token, expiresAt: info.expiresAt, exchanged: false }

    // 系统用户令牌本身就不过期，拿去换反而会失败
    if (info.type !== 'USER') return asIs

    // fb_exchange_token 只认本应用签发的令牌。客户用自己的 Meta 应用生成的
    // 长期令牌我们换不动，但它照样能用，不能因为换不了就把人挡在门外。
    const blocker = this.exchangeBlocker(info)
    if (blocker) {
      if (isShortLived(info.expiresAt)) {
        throw new BadRequestException(
          `这是一条短期用户令牌，由它换出的主页凭证一小时后就会失效，而本系统换不了它（${blocker}）。` +
            '请改用商务管理平台的系统用户令牌，或先在图形 API 工具里换成长期令牌再粘贴。',
        )
      }
      this.logger.warn(`跳过长期令牌换取：${blocker}`)
      return asIs
    }

    const longLived = await friendly(
      () => exchangeForLongLived(token, this.appId, this.appSecret),
      '换取长期令牌',
    )
    const after = await friendly(() => inspectToken(longLived), '校验长期令牌')
    return { token: longLived, expiresAt: after.expiresAt, exchanged: true }
  }

  /** 返回换不了的原因，能换则返回空 */
  private exchangeBlocker(info: TokenInfo): string {
    if (!this.appId || !this.appSecret) return '本系统未配置 Facebook 应用密钥'
    if (info.appId && info.appId !== this.appId) return `令牌来自另一个 Facebook 应用 ${info.appId}`
    return ''
  }

  private async fetchPages(token: string): Promise<LinkablePage[]> {
    const res = await this.fetchAccounts(token)

    const pages = (res.data ?? [])
      .filter((p) => p.access_token && p.tasks?.includes('CREATE_CONTENT'))
      .map((p) => {
        const ig = p.instagram_business_account
        return {
          pageId: p.id,
          name: p.name,
          avatar: p.picture?.data?.url,
          followers: p.followers_count ?? p.fan_count ?? 0,
          accessToken: p.access_token as string,
          instagram: ig
            ? {
                igUserId: ig.id,
                username: ig.username ?? ig.id,
                avatar: ig.profile_picture_url,
                followers: ig.followers_count ?? 0,
                postsCount: ig.media_count ?? 0,
              }
            : undefined,
        }
      })

    if (!pages.length) {
      throw new BadRequestException('该令牌名下没有可发布的主页，请确认已分配主页资产与发布权限')
    }
    return pages
  }

  /**
   * 令牌没有 instagram_basic 时，带上 IG 字段会让整个请求被拒。绑主页是主线，
   * 不能因为读不到 IG 就连主页都列不出来，所以失败后退回只读主页再试一次。
   */
  private async fetchAccounts(token: string): Promise<AccountsEdge> {
    try {
      return await graphGet<AccountsEdge>(
        '/me/accounts',
        { fields: `${PAGE_FIELDS},${IG_FIELDS}`, limit: '100' },
        token,
      )
    } catch (err) {
      this.logger.warn(`带 Instagram 字段读取主页失败，退回只读主页: ${err}`)
      return friendly(
        () => graphGet<AccountsEdge>('/me/accounts', { fields: PAGE_FIELDS, limit: '100' }, token),
        '读取主页列表',
      )
    }
  }
}

function assertUsable(info: TokenInfo) {
  if (info.type === 'PAGE') {
    throw new BadRequestException('这是一条主页令牌，请粘贴系统用户令牌或用户令牌')
  }

  // debug_token 没给出 scopes 时不做判断：拿不到清单不等于没有权限，
  // 据此拒绝会把本来能用的令牌挡在门外
  if (!info.scopes.length) return

  const missing = REQUIRED_SCOPES.filter((s) => !info.scopes.includes(s))
  if (missing.length) {
    throw new BadRequestException(`令牌缺少权限：${missing.join('、')}，请补齐后重新生成`)
  }
}

function isShortLived(expiresAt: number): boolean {
  return expiresAt > 0 && expiresAt * 1000 - Date.now() < SHORT_LIVED_MAX_MS
}

async function friendly<T>(fn: () => Promise<T>, action: string): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof BadRequestException) throw err
    if (err instanceof GraphError && err.isAuthError) {
      throw new BadRequestException('令牌无效或已被吊销，请到商务管理平台重新生成')
    }
    if (err instanceof GraphError && err.isRateLimit) {
      throw new BadRequestException('Facebook 接口限流，请稍后再试')
    }
    throw new BadRequestException(`${action}失败: ${err instanceof Error ? err.message : err}`)
  }
}
