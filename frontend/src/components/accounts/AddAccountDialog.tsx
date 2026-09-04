import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Link2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TikTokLoginDialog } from './TikTokLoginDialog'
import { FacebookLinkDialog, type MetaLinkResult } from './FacebookLinkDialog'
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
  // 靠 cookie 内容长相判断来源会把手动粘贴的 JSON 误认成登录所得，从而把输入框收起来
  const [cookiesFromLogin, setCookiesFromLogin] = useState(false)
  const [tiktokLoginOpen, setTiktokLoginOpen] = useState(false)
  const [metaLinkOpen, setMetaLinkOpen] = useState(false)
  const [metaSession, setMetaSession] = useState<Record<string, string> | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.post('/accounts', {
      platform, username, displayName,
      avatar: avatar || undefined,
      sessionData: buildSessionData(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      handleClose()
    },
  })

  function buildSessionData() {
    if (isMeta) return metaSession ?? undefined
    return cookies.trim() ? { cookies: cookies.trim() } : undefined
  }

  function handleClose() {
    setPlatform('tiktok')
    setUsername('')
    setDisplayName('')
    setAvatar('')
    setCookies('')
    setCookiesFromLogin(false)
    setMetaSession(null)
    onClose()
  }

  function handleMetaLink(result: MetaLinkResult) {
    setMetaSession(result.sessionData)
    setUsername(result.username)
    setDisplayName(result.displayName)
    if (result.avatar) setAvatar(result.avatar)
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
    setCookiesFromLogin(true)
    setTiktokLoginOpen(false)
  }

  const isTikTok = platform === 'tiktok'
  const isMeta = platform === 'facebook' || platform === 'instagram'
  const hasQrCookies = isTikTok && cookiesFromLogin
  const canSubmit = username.trim() && displayName.trim() && (!isMeta || metaSession)

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
              <Select
                value={platform}
                onValueChange={(v) => {
                  setPlatform(v as Platform)
                  // 换平台后原来那份凭证已经对不上了，留着会被当成绑好了
                  setMetaSession(null)
                }}
              >
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

            {/* TikTok 专属：账号密码登录（可切换扫码） */}
            {isTikTok && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">登录 TikTok</p>
                    <p className="text-xs text-muted-foreground">
                      {hasQrCookies ? '✓ 已获取登录状态' : '账号密码登录，自动获取登录凭证'}
                    </p>
                  </div>
                  <Button
                    variant={hasQrCookies ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => setTiktokLoginOpen(true)}
                  >
                    <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                    {hasQrCookies ? '重新登录' : '登录'}
                  </Button>
                </div>
              </div>
            )}

            {/* Facebook / Instagram：粘贴系统用户令牌后选主页或它关联的 IG 账号 */}
            {isMeta && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {platform === 'instagram' ? '绑定 Instagram 账号' : '绑定主页'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metaSession
                        ? `✓ 已绑定 ${metaSession.igUserId ?? metaSession.pageId}`
                        : platform === 'instagram'
                          ? '用商务平台令牌读取主页下的 Instagram 账号'
                          : '用商务平台令牌读取并选择主页'}
                    </p>
                  </div>
                  <Button
                    variant={metaSession ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => setMetaLinkOpen(true)}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    {metaSession ? '重新绑定' : '绑定'}
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

            {/* Facebook 走 token 不走 cookie；TikTok 登录成功后不再需要手动粘贴 */}
            {!isFacebook && (!isTikTok || !hasQrCookies) && (
              <div className="space-y-1.5">
                <Label>
                  Cookies / Session
                  <span className="text-muted-foreground ml-1">(optional)</span>
                </Label>
                <Textarea
                  placeholder={isTikTok ? '或手动粘贴 Cookie（支持 Cookie-Editor 导出的 JSON）…' : '粘贴 Cookie 字符串…'}
                  rows={3}
                  value={cookies}
                  onChange={(e) => {
                    setCookies(e.target.value)
                    setCookiesFromLogin(false)
                  }}
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
              disabled={!canSubmit || mutation.isPending}
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

      <FacebookLinkDialog
        open={metaLinkOpen}
        platform={platform === 'instagram' ? 'instagram' : 'facebook'}
        onClose={() => setMetaLinkOpen(false)}
        onSuccess={handleMetaLink}
      />
    </>
  )
}
