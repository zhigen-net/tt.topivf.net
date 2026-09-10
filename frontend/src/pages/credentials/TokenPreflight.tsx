import { CheckCircle2, TriangleAlert } from 'lucide-react'
import { describeExpiry } from './credential-labels'
import { SECTION_FOR_CODE, type GuideSectionId } from './CredentialGuide'
import type { CredentialErrorCode, TokenReport } from '@/types'

const TOKEN_TYPE_LABELS: Record<string, string> = {
  SYSTEM_USER: '系统用户令牌',
  USER: '用户令牌',
  PAGE: '主页令牌',
}

/** 后端把 code 塞在响应体里，跟 message 平级 */
export function errorCode(err: unknown): CredentialErrorCode | undefined {
  return (err as { response?: { data?: { code?: CredentialErrorCode } } })?.response?.data?.code
}

/**
 * 报错不能只丢一句红字。凡是能对上教程小节的，都给一个直达链接——
 * 用户卡住的点几乎总是「那我现在该去哪一步」，不是「这句话什么意思」。
 */
export function CredentialError({ err, onJump }: {
  err: unknown
  onJump: (section: GuideSectionId) => void
}) {
  const code = errorCode(err)
  const section = code && SECTION_FOR_CODE[code]

  return (
    <div className="space-y-1.5 rounded-md bg-destructive/10 px-3 py-2">
      <p className="flex items-start gap-2 text-sm text-destructive">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 break-words">{errorText(err)}</span>
      </p>
      {section && (
        <button
          type="button"
          onClick={() => onJump(section)}
          className="pl-5.5 text-xs font-medium text-destructive underline underline-offset-2"
        >
          查看这一步该怎么做
        </button>
      )}
    </div>
  )
}

/** 体检表。目的是让用户一次看全所有毛病，而不是提交一次改一处 */
export function TokenPreflightPanel({ report, onJump }: {
  report: TokenReport
  onJump: (section: GuideSectionId) => void
}) {
  const ok = !report.problems.length

  return (
    <div className="space-y-2 rounded-md border p-3 text-xs">
      <p className={`flex items-center gap-1.5 text-sm font-medium ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
        {ok ? '这条令牌可以直接用' : `发现 ${report.problems.length} 个问题`}
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
        <dt>类型</dt>
        <dd className="text-foreground">{TOKEN_TYPE_LABELS[report.tokenType] ?? report.tokenType}</dd>
        <dt>有效期</dt>
        <dd className="text-foreground">{describeExpiry(report.expiresAt)}</dd>
        <dt>权限</dt>
        <dd className="text-foreground">
          {report.scopes.length ? report.scopes.join('、') : '（Facebook 未返回权限清单）'}
        </dd>
        <dt>可发布主页</dt>
        <dd className="text-foreground">
          {report.pageCount} 个
          {report.instagramCount > 0 && ` · 关联 ${report.instagramCount} 个 Instagram`}
        </dd>
      </dl>

      {report.pages.length > 0 && (
        <p className="text-muted-foreground">
          {report.pages.map((p) => p.name).join('、')}
          {report.pageCount > report.pages.length && ` 等 ${report.pageCount} 个`}
        </p>
      )}

      {report.problems.map((p) => {
        const section = SECTION_FOR_CODE[p.code]
        return (
          <p key={p.code} className="rounded bg-amber-500/10 px-2 py-1.5 text-amber-700 dark:text-amber-500">
            {p.message}
            {section && (
              <button
                type="button"
                onClick={() => onJump(section)}
                className="ml-1 font-medium underline underline-offset-2"
              >
                怎么改
              </button>
            )}
          </p>
        )
      })}
    </div>
  )
}

export function errorText(err: unknown): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  if (Array.isArray(message)) return message.join('；')
  return typeof message === 'string' ? message : '操作失败，请重试'
}
