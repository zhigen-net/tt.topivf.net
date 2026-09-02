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
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) })
  const body = await res.json().catch(() => null)

  if (body?.error) {
    const { code, error_subcode, message } = body.error
    throw new GraphError(Number(code), error_subcode ? Number(error_subcode) : undefined, message)
  }
  if (!res.ok) throw new GraphError(res.status, undefined, `Graph HTTP ${res.status}`)

  return body as T
}

export function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: token })
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
