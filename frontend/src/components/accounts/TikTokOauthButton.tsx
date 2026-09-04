import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface Props {
  onSuccess: () => void
}

interface OauthMessage {
  source: 'tiktok-oauth'
  ok: boolean
  message: string
}

/**
 * 官方授权是后端在回调里直接建号的，不需要前端再提交表单。授权窗口和当前页面
 * 同源（回调落在自家 /api/v1 上），所以能靠 postMessage 把结果送回来。
 */
export function TikTokOauthButton({ onSuccess }: Props) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const popup = useRef<Window | null>(null)

  const start = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ url: string }>('/tiktok/oauth/start', {})
      return data.url
    },
    onSuccess: (url) => {
      setStatus(null)
      popup.current = window.open(url, 'tiktok-oauth', 'width=600,height=780')
      if (!popup.current) setStatus({ ok: false, message: '浏览器拦截了弹窗，请允许后重试' })
    },
    onError: (err) => setStatus({ ok: false, message: describe(err) }),
  })

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // 授权窗口能被任意页面打开，只认同源消息，否则第三方站点可以伪造成功
      if (e.origin !== window.location.origin) return
      const data = e.data as OauthMessage | undefined
      if (data?.source !== 'tiktok-oauth') return

      setStatus({ ok: data.ok, message: data.message })
      if (data.ok) {
        qc.invalidateQueries({ queryKey: ['accounts'] })
        qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
        onSuccess()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [qc, onSuccess])

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">官方授权接入</p>
          <p className="text-xs text-muted-foreground">
            走 TikTok 官方接口发布，不用维护 Cookie，授权成功后账号自动建好
          </p>
        </div>
        <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
          <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
          {start.isPending ? '跳转中…' : '去授权'}
        </Button>
      </div>
      {status && (
        <p className={`text-xs ${status.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
          {status.ok ? `✓ ${status.message}` : status.message}
        </p>
      )}
    </div>
  )
}

function describe(err: unknown): string {
  const res = (err as { response?: { data?: { message?: string } } }).response
  return res?.data?.message ?? '发起授权失败，请稍后重试'
}
