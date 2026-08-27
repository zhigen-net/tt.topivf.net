import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, CheckCircle2, XCircle, Smartphone, KeyRound } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type Phase = 'form' | 'loading' | 'interactive' | 'qr' | 'success' | 'failed' | 'expired'

interface InputAction {
  type: 'click' | 'type' | 'key' | 'scroll'
  x?: number
  y?: number
  deltaY?: number
  value?: string
}

const SPECIAL_KEYS = [
  'Enter', 'Backspace', 'Tab', 'Escape', 'Delete',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End',
]

export function TikTokLoginDialog({ open, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>('form')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [qrBase64, setQrBase64] = useState('')
  const [screen, setScreen] = useState<{ data: string; width: number; height: number } | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<{ username?: string; displayName?: string; avatar?: string }>({})

  const sessionIdRef = useRef<string | null>(null)
  const statusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const screenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const screenBusyRef = useRef(false)

  useEffect(() => {
    if (!open) return
    reset()
    return () => {
      stopTimers()
      cancelSession()
    }
  }, [open])

  function reset() {
    setPhase('form')
    setIdentifier('')
    setPassword('')
    setQrBase64('')
    setScreen(null)
    setError('')
    setInfo({})
  }

  function stopTimers() {
    if (statusTimerRef.current) clearInterval(statusTimerRef.current)
    if (screenTimerRef.current) clearInterval(screenTimerRef.current)
    statusTimerRef.current = null
    screenTimerRef.current = null
  }

  async function startPasswordLogin() {
    setPhase('loading')
    setError('')
    try {
      const res = await api.post<{ sessionId: string }>('/tiktok/login-session', {
        method: 'password',
        identifier: identifier.trim() || undefined,
        password: password || undefined,
      })
      sessionIdRef.current = res.data.sessionId
      setPassword('')  // 密码只用于提交这一次，之后不再留在前端状态里
      setPhase('interactive')
      statusTimerRef.current = setInterval(pollStatus, 3000)
      screenTimerRef.current = setInterval(pollScreen, 800)
      pollScreen()
    } catch {
      setPhase('failed')
    }
  }

  async function startQrLogin() {
    setPhase('loading')
    setError('')
    try {
      const res = await api.post<{ sessionId: string; qrCodeBase64: string }>('/tiktok/login-session', {
        method: 'qr',
      })
      sessionIdRef.current = res.data.sessionId
      setQrBase64(res.data.qrCodeBase64)
      setPhase('qr')
      statusTimerRef.current = setInterval(pollStatus, 3000)
    } catch {
      setPhase('failed')
    }
  }

  async function pollScreen() {
    const id = sessionIdRef.current
    if (!id || screenBusyRef.current) return
    screenBusyRef.current = true
    try {
      const res = await api.get<{ screenBase64: string; width: number; height: number }>(
        `/tiktok/login-session/${id}/screen`,
      )
      setScreen({ data: res.data.screenBase64, width: res.data.width, height: res.data.height })
    } catch {
      // 会话结束后截图会失败，交给状态轮询收尾
    } finally {
      screenBusyRef.current = false
    }
  }

  async function pollStatus() {
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
        lastError?: string
      }>(`/tiktok/login-session/${id}`)

      const { status, qrCodeBase64, username, displayName, avatar, cookies, lastError } = res.data

      if (qrCodeBase64) setQrBase64(qrCodeBase64)
      if (lastError) setError(lastError)

      if (status === 'success' && cookies) {
        stopTimers()
        setInfo({ username, displayName, avatar })
        setPhase('success')
        setTimeout(() => {
          onSuccess({ username, displayName, avatar, cookies })
          handleClose()
        }, 1500)
      } else if (status === 'failed') {
        stopTimers()
        setPhase('failed')
      } else if (status === 'expired') {
        stopTimers()
        setPhase('expired')
      }
    } catch {
      // 忽略轮询网络错误
    }
  }

  async function sendInput(action: InputAction) {
    const id = sessionIdRef.current
    if (!id) return
    try {
      await api.post(`/tiktok/login-session/${id}/input`, action)
      pollScreen()
    } catch {
      // 输入失败不阻断，下一帧截图会反映真实状态
    }
  }

  function handleScreenClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!screen) return
    const rect = e.currentTarget.getBoundingClientRect()
    sendInput({
      type: 'click',
      x: Math.round((e.clientX - rect.left) * (screen.width / rect.width)),
      y: Math.round((e.clientY - rect.top) * (screen.height / rect.height)),
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (SPECIAL_KEYS.includes(e.key)) {
      e.preventDefault()
      sendInput({ type: 'key', value: e.key })
    } else if (e.key.length === 1) {
      e.preventDefault()
      sendInput({ type: 'type', value: e.key })
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text')
    if (!text) return
    e.preventDefault()
    sendInput({ type: 'type', value: text })
  }

  async function cancelSession() {
    stopTimers()
    const id = sessionIdRef.current
    sessionIdRef.current = null
    if (id) api.delete(`/tiktok/login-session/${id}`).catch(() => {})
  }

  function handleClose() {
    cancelSession()
    onClose()
  }

  const wide = phase === 'interactive'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className={wide ? 'max-w-4xl' : 'max-w-sm'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">TikTok</span>
            <span className="text-muted-foreground font-normal text-sm">
              {phase === 'qr' ? '扫码登录' : '账号密码登录'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {phase === 'form' && (
            <div className="w-full space-y-4">
              <div className="space-y-1.5">
                <Label>邮箱 / 手机号 / 用户名</Label>
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label>密码</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && identifier.trim() && startPasswordLogin()}
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                密码仅用于在服务器上代填登录表单，不会被保存。若出现滑块验证或二次验证，
                下一步可以直接在远程画面里手动完成。
              </p>
              <Button className="w-full" onClick={startPasswordLogin} disabled={!identifier.trim()}>
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                登录
              </Button>
              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                onClick={startQrLogin}
              >
                改用扫码登录
              </button>
            </div>
          )}

          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">正在打开 TikTok 登录页…</p>
            </div>
          )}

          {phase === 'interactive' && (
            <div className="w-full space-y-2">
              <div
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="rounded-lg border overflow-hidden bg-black outline-none focus:ring-2 focus:ring-primary"
              >
                {screen ? (
                  <img
                    src={`data:image/jpeg;base64,${screen.data}`}
                    alt="TikTok 登录画面"
                    className="w-full cursor-pointer select-none"
                    draggable={false}
                    onClick={handleScreenClick}
                  />
                ) : (
                  <div className="h-96 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                点击画面可交互，先点一下输入框再打字。滑块验证、二次验证码都在这里完成，
                登录成功后会自动关闭。
              </p>
              {error && <p className="text-sm text-destructive">TikTok 提示：{error}</p>}
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
                {phase === 'expired' ? '登录会话已过期' : error || '登录失败'}
              </p>
              <Button variant="outline" size="sm" onClick={reset}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                重新开始
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
