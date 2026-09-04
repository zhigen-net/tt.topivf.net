const API = 'https://open.tiktokapis.com/v2'

/**
 * TikTok 的错误分两层：HTTP 层的 error.code 是字符串（"access_token_invalid"），
 * 而发布任务失败时的 fail_reason 又是另一套枚举。统一收敛到这里，
 * 让适配器只需要判断 isAuthError / isRateLimit。
 */
export class TiktokApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly logId?: string,
  ) {
    super(message)
  }

  /** 只有这类意味着授权真的废了，要用户重新走一遍授权 */
  get isAuthError(): boolean {
    return this.code === 'access_token_invalid'
      || this.code === 'access_token_expired'
      || this.code === 'refresh_token_invalid'
      || this.code === 'refresh_token_expired'
      || this.code === 'scope_not_authorized'
  }

  /** 限流是暂时的，不能据此把账号标成失效 */
  get isRateLimit(): boolean {
    return this.code === 'rate_limit_exceeded' || this.code === 'spam_risk_too_many_posts'
  }
}

const DEFAULT_TIMEOUT_MS = 30_000

interface TiktokEnvelope<T> {
  data?: T
  error?: { code?: string; message?: string; log_id?: string }
}

/**
 * 成功时 error.code 是字符串 "ok" 而不是缺省，只判断 error 存在会把所有正常
 * 响应都当成失败。
 */
export async function tiktokRequest<T>(
  path: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const body = (await res.json().catch(() => null)) as TiktokEnvelope<T> | null

  const err = body?.error
  if (err?.code && err.code !== 'ok') {
    throw new TiktokApiError(err.code, err.message ?? err.code, err.log_id)
  }
  if (!res.ok) {
    throw new TiktokApiError(`http_${res.status}`, `TikTok HTTP ${res.status}`)
  }
  return (body?.data ?? body) as T
}

export function tiktokPost<T>(path: string, body: unknown, token: string, timeoutMs?: number) {
  return tiktokRequest<T>(path, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  }, timeoutMs)
}

export function tiktokGet<T>(path: string, params: Record<string, string>, token: string) {
  const qs = new URLSearchParams(params)
  return tiktokRequest<T>(`${path}?${qs}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}
