import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { graphGet, GraphError } from './graph-api'
import { exchangeForLongLived, inspectToken, type TokenInfo } from './token'
import {
  credentialError, MESSAGES, toProblem, type CredentialProblem,
} from './credential-errors'

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
  paging?: { cursors?: { after?: string } }
}

/** 校验并（必要时）升级过的令牌，凭证托管要存的是这一条而不是用户粘的那条 */
export interface ResolvedToken {
  token: string
  info: TokenInfo
  expiresAt: number
  exchanged: boolean
}

/** 令牌体检结果。给「粘贴前先看看差在哪」用，不落库 */
export interface TokenReport {
  tokenType: string
  appId: string
  scopes: string[]
  missingScopes: string[]
  requiredScopes: string[]
  /** unix 秒；0 表示永不过期 */
  expiresAt: number
  /** 能不能被本系统换成长期令牌；换不动时给出原因 */
  exchangeBlocker: string
  pageCount: number
  instagramCount: number
  pages: Array<{ name: string; followers: number; instagram: string | null }>
  problems: CredentialProblem[]
}

const PAGE_FIELDS = 'id,name,access_token,followers_count,fan_count,picture,tasks'
const IG_FIELDS =
  'instagram_business_account{id,username,profile_picture_url,followers_count,media_count}'

// 只列发布链路真正跑不动的那两个：缺 pages_read_engagement 只是读不到粉丝数和
// 转码状态，适配器本来就能降级，不该因此把令牌挡在门外
const REQUIRED_SCOPES = ['pages_show_list', 'pages_manage_posts']

// 短期令牌 1~2 小时，长期令牌 60 天，拿一周做界足够把两者分开
const SHORT_LIVED_MAX_MS = 7 * 24 * 60 * 60 * 1000

const PAGE_SIZE = 100
// 兜底，避免游标出问题时无限翻页
const MAX_PAGES = 20

// 体检表只是让用户确认「认得出这些主页」，列全没意义
const PREVIEW_PAGES = 20

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
    const resolved = await this.resolveToken(input)
    const pages = await this.fetchPages(resolved.token)

    this.logger.log(
      `Listed ${pages.length} linkable page(s) from ${resolved.info.type} token` +
        (resolved.exchanged ? ' (exchanged for long-lived)' : ''),
    )
    return {
      pages,
      tokenType: resolved.info.type,
      expiresAt: resolved.expiresAt,
      exchanged: resolved.exchanged,
    }
  }

  /** 校验令牌可用，短期的先换成长期。凭证托管存的是返回的这条 token */
  async resolveToken(input: string): Promise<ResolvedToken> {
    const info = await friendly(() => inspectToken(input), '校验令牌')
    assertUsable(info)
    const upgraded = await this.ensureLongLived(input, info)
    return { ...upgraded, info }
  }

  /**
   * 只读体检。除了令牌本身就是废的，其余问题一律记进 problems 而不是抛出去——
   * 用户需要一次看全自己差在哪，而不是提交一次改一处、来回试错。
   */
  async inspect(input: string): Promise<TokenReport> {
    const info = await friendly(() => inspectToken(input), '校验令牌')
    const problems: CredentialProblem[] = []
    const missingScopes = missingScopesOf(info)
    const blocker = this.exchangeBlocker(info)

    if (info.type === 'PAGE') problems.push({ code: 'PAGE_TOKEN', message: MESSAGES.pageToken })
    if (missingScopes.length) {
      problems.push({ code: 'MISSING_SCOPES', message: MESSAGES.missingScopes(missingScopes) })
    }
    if (info.type === 'USER' && blocker && isShortLived(info.expiresAt)) {
      problems.push({ code: 'SHORT_LIVED', message: MESSAGES.shortLived(blocker) })
    }

    // 主页令牌打 /me/accounts 只会把同一个问题再报一遍，白跑一趟
    let pages: LinkablePage[] = []
    if (info.type !== 'PAGE') {
      try {
        pages = await this.fetchPages(input)
      } catch (err) {
        problems.push(toProblem(err))
      }
    }

    return {
      tokenType: info.type,
      appId: info.appId,
      scopes: info.scopes,
      missingScopes,
      requiredScopes: [...REQUIRED_SCOPES],
      expiresAt: info.expiresAt,
      exchangeBlocker: blocker,
      pageCount: pages.length,
      instagramCount: pages.filter((p) => p.instagram).length,
      // 只投影展示要用的字段：pages 里带着主页令牌，整条回给前端等于把凭证发出去
      pages: pages.slice(0, PREVIEW_PAGES).map((p) => ({
        name: p.name,
        followers: p.followers,
        instagram: p.instagram?.username ?? null,
      })),
      problems,
    }
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
        throw credentialError('SHORT_LIVED', MESSAGES.shortLived(blocker))
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

  async fetchPages(token: string): Promise<LinkablePage[]> {
    const rows = await this.fetchAllAccounts(token)

    const pages = rows
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

    if (!pages.length) throw credentialError('NO_PAGES', MESSAGES.noPages)
    return pages
  }

  /**
   * 主页多到翻页时，只取第一页会让后面的主页在「可接入」列表里凭空消失，
   * 而且没有任何报错——自动发现要靠这份列表做 diff，必须取全。
   */
  private async fetchAllAccounts(token: string): Promise<AccountsEdge['data']> {
    const rows: AccountsEdge['data'] = []
    let after: string | undefined

    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await this.fetchAccounts(token, after)
      rows.push(...(res.data ?? []))

      after = res.paging?.cursors?.after
      if (!after || !res.data?.length) return rows
    }
    this.logger.warn(`主页数量超过 ${MAX_PAGES * PAGE_SIZE}，后续分页已忽略`)
    return rows
  }

  /**
   * 令牌没有 instagram_basic 时，带上 IG 字段会让整个请求被拒。绑主页是主线，
   * 不能因为读不到 IG 就连主页都列不出来，所以失败后退回只读主页再试一次。
   */
  private async fetchAccounts(token: string, after?: string): Promise<AccountsEdge> {
    const params = { limit: String(PAGE_SIZE), ...(after ? { after } : {}) }
    try {
      return await graphGet<AccountsEdge>(
        '/me/accounts',
        { ...params, fields: `${PAGE_FIELDS},${IG_FIELDS}` },
        token,
      )
    } catch (err) {
      this.logger.warn(`带 Instagram 字段读取主页失败，退回只读主页: ${err}`)
      return friendly(
        () => graphGet<AccountsEdge>('/me/accounts', { ...params, fields: PAGE_FIELDS }, token),
        '读取主页列表',
      )
    }
  }
}

function assertUsable(info: TokenInfo) {
  if (info.type === 'PAGE') throw credentialError('PAGE_TOKEN', MESSAGES.pageToken)

  const missing = missingScopesOf(info)
  if (missing.length) {
    throw credentialError('MISSING_SCOPES', MESSAGES.missingScopes(missing))
  }
}

// debug_token 没给出 scopes 时不做判断：拿不到清单不等于没有权限，
// 据此拒绝会把本来能用的令牌挡在门外
function missingScopesOf(info: TokenInfo): string[] {
  if (!info.scopes.length) return []
  return REQUIRED_SCOPES.filter((s) => !info.scopes.includes(s))
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
      throw credentialError('TOKEN_INVALID', MESSAGES.tokenInvalid)
    }
    if (err instanceof GraphError && err.isRateLimit) {
      throw credentialError('RATE_LIMITED', MESSAGES.rateLimited)
    }
    throw credentialError('GRAPH_ERROR', `${action}失败: ${err instanceof Error ? err.message : err}`)
  }
}
