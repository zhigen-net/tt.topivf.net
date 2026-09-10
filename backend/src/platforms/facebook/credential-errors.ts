import { BadRequestException } from '@nestjs/common'

/** 前端按 code 把用户送到接入指引的对应小节，改字面量等于改前端契约 */
export type CredentialErrorCode =
  | 'PAGE_TOKEN'
  | 'SHORT_LIVED'
  | 'MISSING_SCOPES'
  | 'NO_PAGES'
  | 'TOKEN_INVALID'
  | 'RATE_LIMITED'
  | 'NO_ENCRYPTION_KEY'
  | 'GRAPH_ERROR'

export interface CredentialProblem {
  code: CredentialErrorCode
  message: string
}

// 传对象时 Nest 原样当响应体发出去，前端读的 message 仍在原位，只是多了 code
export function credentialError(code: CredentialErrorCode, message: string) {
  return new BadRequestException({ message, code })
}

/** 校验和预检要说同一句话，否则同一个问题在两条路径上措辞不一样 */
export const MESSAGES = {
  pageToken: '这是一条主页令牌，请粘贴系统用户令牌或用户令牌',
  noPages: '该令牌名下没有可发布的主页，请确认已分配主页资产与发布权限',
  tokenInvalid: '令牌无效或已被吊销，请到商务管理平台重新生成',
  rateLimited: 'Facebook 接口限流，请稍后再试',
  noEncryptionKey: '未配置 CREDENTIAL_ENCRYPTION_KEY，无法托管令牌。请先在服务端配置该密钥并重启。',
  missingScopes: (missing: string[]) => `令牌缺少权限：${missing.join('、')}，请补齐后重新生成`,
  shortLived: (blocker: string) =>
    `这是一条短期用户令牌，由它换出的主页凭证一小时后就会失效，而本系统换不了它（${blocker}）。`
    + '请改用商务管理平台的系统用户令牌，或先在图形 API 工具里换成长期令牌再粘贴。',
} as const

/** 把已经带了 code 的异常还原成 problem，用于预检里「记下来但不抛」 */
export function toProblem(err: unknown): CredentialProblem {
  if (err instanceof BadRequestException) {
    const res = err.getResponse() as { message?: string; code?: CredentialErrorCode }
    if (typeof res === 'object' && res.code) return { code: res.code, message: res.message ?? err.message }
    return { code: 'GRAPH_ERROR', message: typeof res === 'string' ? res : err.message }
  }
  return { code: 'GRAPH_ERROR', message: err instanceof Error ? err.message : String(err) }
}
