import { BadRequestException } from '@nestjs/common'
import { graphGet } from './graph-api'

export interface TokenInfo {
  /** USER / SYSTEM_USER / PAGE */
  type: string
  appId: string
  scopes: string[]
  /** unix 秒；0 表示永不过期 */
  expiresAt: number
}

interface DebugTokenResponse {
  data?: {
    type?: string
    app_id?: string
    is_valid?: boolean
    scopes?: string[]
    expires_at?: number
    data_access_expires_at?: number
  }
}

/**
 * 用令牌自己去 debug 自己。应用后台列出的权限只是「可申请」，
 * 这里返回的 scopes 才是这条令牌真正带上的。
 */
export async function inspectToken(token: string): Promise<TokenInfo> {
  const res = await graphGet<DebugTokenResponse>('/debug_token', { input_token: token }, token)
  const data = res.data
  if (!data?.is_valid) throw new BadRequestException('令牌无效或已被吊销，请重新生成')

  return {
    type: data.type ?? 'UNKNOWN',
    appId: data.app_id ?? '',
    scopes: data.scopes ?? [],
    expiresAt: earliest(data.expires_at, data.data_access_expires_at),
  }
}

/**
 * 短期用户令牌约 1~2 小时就过期，而**主页令牌的寿命跟着签发它的用户令牌走**——
 * 拿短期令牌去换主页令牌，换出来的东西一小时后就死，且当场看不出任何异常。
 * 所以必须先把用户令牌换成长期的，再去 /me/accounts。
 */
export async function exchangeForLongLived(
  token: string,
  appId: string,
  appSecret: string,
): Promise<string> {
  const res = await graphGet<{ access_token?: string }>('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: token,
  })
  if (!res.access_token) throw new BadRequestException('换取长期令牌失败：Facebook 没有返回令牌')
  return res.access_token
}

/**
 * data_access_expires_at 是独立于 expires_at 的另一条 90 天时钟，到点后令牌仍然
 * "有效"但读不到数据，所以有效期要按两者里先到的那个算。
 */
function earliest(...times: Array<number | undefined>): number {
  const live = times.filter((t): t is number => typeof t === 'number' && t > 0)
  return live.length ? Math.min(...live) : 0
}
