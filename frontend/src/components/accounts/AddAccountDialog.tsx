import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QrCode } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TikTokLoginDialog } from './TikTokLoginDialog'
import { api } from '@/lib/api'
import type { Platform } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

const platforms: { value: Platform; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'facebook', label: 'Facebook' },
]

export function AddAccountDialog({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [platform, setPlatform] = useState<Platform>('tiktok')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatar, setAvatar] = useState('')
  const [cookies, setCookies] = useState('')
  const [tiktokLoginOpen, setTiktokLoginOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.post('/accounts', {
      platform, username, displayName,
      avatar: avatar || undefined,
      sessionData: cookies.trim() ? { cookies: cookies.trim() } : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      handleClose()
    },
  })

  function handleClose() {
    setPlatform('tiktok')
    setUsername('')
    setDisplayName('')
    setAvatar('')
    setCookies('')
    onClose()
  }

  function handleTikTokLoginSuccess(result: {
    username?: string
    displayName?: string
    avatar?: string
    cookies: string
  }) {
    if (result.username) setUsername(result.username)
    if (result.displayName) setDisplayName(result.displayName)
    if (result.avatar) setAvatar(result.avatar)
    setCookies(result.cookies)
    setTiktokLoginOpen(false)
  }

  const isTikTok = platform === 'tiktok'
  const hasQrCookies = isTikTok && cookies.trim().startsWith('[')

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* TikTok 专属：QR 扫码登录 */}
            {isTikTok && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">扫码登录</p>
                    <p className="text-xs text-muted-foreground">
                      {hasQrCookies ? '✓ 已通过扫码获取登录状态' : '推荐：用手机扫码，自动获取登录凭证'}
                    </p>
                  </div>
                  <Button
                    variant={hasQrCookies ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => setTiktokLoginOpen(true)}
                  >
                    <QrCode className="h-3.5 w-3.5 mr-1.5" />
                    {hasQrCookies ? '重新扫码' : '扫码登录'}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                placeholder="@username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Avatar URL <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="https://..."
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
              />
            </div>

            {/* 非 TikTok 或手动 cookie 备用 */}
            {(!isTikTok || !hasQrCookies) && (
              <div className="space-y-1.5">
                <Label>
                  Cookies / Session
                  <span className="text-muted-foreground ml-1">(optional)</span>
                </Label>
                <Textarea
                  placeholder={isTikTok ? '或手动粘贴 Cookie…' : '粘贴 Cookie 字符串…'}
                  rows={3}
                  value={cookies}
                  onChange={(e) => setCookies(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            )}

            {mutation.isError && (
              <p className="text-sm text-destructive">添加失败，请重试。</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>取消</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!username.trim() || !displayName.trim() || mutation.isPending}
            >
              {mutation.isPending ? '添加中…' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TikTokLoginDialog
        open={tiktokLoginOpen}
        onClose={() => setTiktokLoginOpen(false)}
        onSuccess={handleTikTokLoginSuccess}
      />
    </>
  )
}
