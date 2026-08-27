import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, CheckCircle2, XCircle, Smartphone } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface LoginResult {
  username?: string
  displayName?: string
  avatar?: string
  cookies: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (result: LoginResult) => void
}

type Phase = 'loading' | 'qr' | 'success' | 'failed' | 'expired'

export function TikTokLoginDialog({ open, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [qrBase64, setQrBase64] = useState<string>('')
  const [info, setInfo] = useState<{ username?: string; displayName?: string; avatar?: string }>({})
  const sessionIdRef = useRef<string | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (open) {
      startSession()
    }
    return () => {
      stopPolling()
      cancelSession()
    }
  }, [open])

  async function startSession() {
    setPhase('loading')
    setQrBase64('')
    try {
      const res = await api.post<{ sessionId: string; qrCodeBase64: string }>('/tiktok/login-session')
      sessionIdRef.current = res.data.sessionId
      setQrBase64(res.data.qrCodeBase64)
      setPhase('qr')
      startPolling()
    } catch {
      setPhase('failed')
    }
  }

  function startPolling() {
    stopPolling()
    pollTimerRef.current = setInterval(poll, 3000)
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  async function poll() {
    const id = sessionIdRef.current
    if (!id) return
    try {
      const res = await api.get<{
        status: string
        qrCodeBase64?: string
        username?: string
        displayName?: string
        avatar?: string
        cookies?: string
      }>(`/tiktok/login-session/${id}`)

      const { status, qrCodeBase64, username, displayName, avatar, cookies } = res.data

      if (qrCodeBase64) setQrBase64(qrCodeBase64)

      if (status === 'success' && cookies) {
        stopPolling()
        setInfo({ username, displayName, avatar })
        setPhase('success')
        setTimeout(() => {
          onSuccess({ username, displayName, avatar, cookies })
          handleClose()
        }, 1500)
      } else if (status === 'failed') {
        stopPolling()
        setPhase('failed')
      } else if (status === 'expired') {
        stopPolling()
        setPhase('expired')
      }
    } catch {
      // 忽略轮询网络错误
    }
  }

  async function cancelSession() {
    stopPolling()
    const id = sessionIdRef.current
    sessionIdRef.current = null
    if (id) {
      api.delete(`/tiktok/login-session/${id}`).catch(() => {})
    }
  }

  function handleClose() {
    cancelSession()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">TikTok</span>
            <span className="text-muted-foreground font-normal text-sm">扫码登录</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">正在生成二维码…</p>
            </div>
          )}

          {phase === 'qr' && (
            <>
              <div className="rounded-xl border p-3 bg-white">
                {qrBase64 ? (
                  <img
                    src={`data:image/png;base64,${qrBase64}`}
                    alt="TikTok 登录二维码"
                    className="w-52 h-52 object-contain"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                <span>打开 TikTok App → 扫一扫</span>
              </div>
              <p className="text-xs text-muted-foreground">二维码 5 分钟内有效，自动刷新</p>
            </>
          )}

          {phase === 'success' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <div className="text-center">
                <p className="font-medium">登录成功</p>
                {info.username && (
                  <p className="text-sm text-muted-foreground mt-1">@{info.username}</p>
                )}
              </div>
            </div>
          )}

          {(phase === 'failed' || phase === 'expired') && (
            <div className="flex flex-col items-center gap-3 py-6">
              <XCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-muted-foreground">
                {phase === 'expired' ? '二维码已过期' : '登录失败'}
              </p>
              <Button variant="outline" size="sm" onClick={startSession}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                重新生成
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            取消
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
