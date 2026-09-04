const GRAPH_VERSION = 'v21.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`
const GRAPH_VIDEO = `https://graph-video.facebook.com/${GRAPH_VERSION}`

export class GraphError extends Error {
  constructor(
    readonly code: number,
    readonly subcode: number | undefined,
    message: string,
  ) {
    super(message)
  }

  /** 只有这类错误意味着凭证真的废了，需要用户重新授权 */
  get isAuthError(): boolean {
    return this.code === 190 || this.code === 102
  }

  /** 限流是暂时的，不能据此把账号标记成失效 */
  get isRateLimit(): boolean {
    return this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613
  }

  /** 权限不足，重试多少次都不会变好 */
  get isPermissionError(): boolean {
    return this.code === 10 || this.code === 200
  }
}

const DEFAULT_TIMEOUT_MS = 60_000
// Facebook 自己去拉取 file_url，大文件可能拉很久
const UPLOAD_TIMEOUT_MS = 10 * 60_000

async function request<T>(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const body = await res.json().catch(() => null)

  if (body?.error) {
    const { code, error_subcode, message } = body.error
    throw new GraphError(Number(code), error_subcode ? Number(error_subcode) : undefined, message)
  }
  if (!res.ok) throw new GraphError(res.status, undefined, `Graph HTTP ${res.status}`)

  return body as T
}

/** token 可省：/oauth/access_token 靠 client_secret 鉴权，多带一个 access_token 会被拒 */
export function graphGet<T>(path: string, params: Record<string, string>, token?: string): Promise<T> {
  const qs = new URLSearchParams(token ? { ...params, access_token: token } : params)
  return request<T>(`${GRAPH}${path}?${qs}`, { method: 'GET' })
}

export function graphPost<T>(
  path: string,
  params: Record<string, string>,
  token: string,
  opts: { videoHost?: boolean } = {},
): Promise<T> {
  const base = opts.videoHost ? GRAPH_VIDEO : GRAPH
  const body = new URLSearchParams({ ...params, access_token: token })
  return request<T>(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
}

/**
 * 把远端文件交给 Reels / Stories 的分片上传端点。
 * rupload 不是 Graph，失败时返回的是 debug_info 而不是 error，得单独解析。
 */
export async function graphUpload(uploadUrl: string, fileUrl: string, token: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { authorization: `OAuth ${token}`, file_url: fileUrl },
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  })
  const body = await res.json().catch(() => null)

  if (body?.debug_info) {
    throw new GraphError(res.status, undefined, body.debug_info.message ?? JSON.stringify(body.debug_info))
  }
  if (body?.error) {
    const { code, error_subcode, message } = body.error
    throw new GraphError(Number(code), error_subcode ? Number(error_subcode) : undefined, message)
  }
  if (!res.ok) throw new GraphError(res.status, undefined, `Upload HTTP ${res.status}`)
}
