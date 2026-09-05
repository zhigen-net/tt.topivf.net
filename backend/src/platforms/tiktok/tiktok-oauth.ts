import { TiktokApiError } from './tiktok-api'

const AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/'
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'

/**
 * video.publish 是直接发布，video.upload 只能进草稿箱。两个都申请，
 * 应用过审前 TikTok 只会授出它批准的那部分，适配器按实际拿到的 scope 决定走哪条路。
 */
export const TIKTOK_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.publish',
  'video.upload',
  // 回收已发布作品的播放/点赞数要它。本次改动之前授权的账号拿不到这个 scope，
  // 适配器按 freshAccessToken 返回的实际 scopes 判断，缺了就跳过而不是写成 0
  'video.list',
]

export const VIDEO_LIST_SCOPE = 'video.list'

export interface TiktokTokens {
  openId: string
  accessToken: string
  refreshToken: string
  scopes: string[]
  /** unix 毫秒 */
  expiresAt: number
  refreshExpiresAt: number
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  open_id?: string
  scope?: string
  expires_in?: number
  refresh_expires_in?: number
  error?: string
  error_description?: string
}

export function buildAuthorizeUrl(clientKey: string, redirectUri: string, state: string): string {
  const qs = new URLSearchParams({
    client_key: clientKey,
    scope: TIKTOK_SCOPES.join(','),
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  })
  return `${AUTHORIZE_URL}?${qs}`
}

export function exchangeCode(
  clientKey: string, clientSecret: string, code: string, redirectUri: string,
): Promise<TiktokTokens> {
  return tokenRequest({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
}

export function refreshTokens(
  clientKey: string, clientSecret: string, refreshToken: string,
): Promise<TiktokTokens> {
  return tokenRequest({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}

/**
 * 令牌端点不走 open.tiktokapis 那套 data/error 信封，而是把字段平铺在顶层、
 * 出错时给 error + error_description，所以不能复用 tiktokRequest。
 */
async function tokenRequest(params: Record<string, string>): Promise<TiktokTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      // 不加这个 TikTok 会返回缓存过的旧令牌
      'cache-control': 'no-cache',
    },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(30_000),
  })
  const body = (await res.json().catch(() => null)) as TokenResponse | null

  if (body?.error) {
    throw new TiktokApiError(body.error, body.error_description ?? body.error)
  }
  if (!body?.access_token || !body.refresh_token || !body.open_id) {
    throw new TiktokApiError(`http_${res.status}`, 'TikTok 没有返回完整的令牌')
  }

  const now = Date.now()
  return {
    openId: body.open_id,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    scopes: body.scope ? body.scope.split(',').map((s) => s.trim()).filter(Boolean) : [],
    expiresAt: now + (body.expires_in ?? 86_400) * 1000,
    refreshExpiresAt: now + (body.refresh_expires_in ?? 31_536_000) * 1000,
  }
}
