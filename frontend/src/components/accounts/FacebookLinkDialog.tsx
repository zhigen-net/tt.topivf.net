import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'

interface LinkablePage {
  pageId: string
  name: string
  avatar?: string
  followers: number
  accessToken: string
}

export interface FacebookLinkResult {
  pageId: string
  pageAccessToken: string
  name: string
  avatar?: string
  followers: number
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (result: FacebookLinkResult) => void
}

export function FacebookLinkDialog({ open, onClose, onSuccess }: Props) {
  const [token, setToken] = useState('')
  const [pages, setPages] = useState<LinkablePage[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setToken('')
    setPages(null)
    setLoading(false)
    setError('')
  }, [open])

  async function loadPages() {
    setLoading(true)
    setError('')
    try {
      const res = await api.post<LinkablePage[]>('/facebook/pages', { token: token.trim() })
      setPages(res.data)
      setToken('')  // 令牌只用于换取主页 token，之后不再留在前端状态里
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '读取主页列表失败')
    } finally {
      setLoading(false)
    }
  }

  function pick(page: LinkablePage) {
    onSuccess({
      pageId: page.pageId,
      pageAccessToken: page.accessToken,
      name: page.name,
      avatar: page.avatar,
      followers: page.followers,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>绑定 Facebook 主页</DialogTitle>
        </DialogHeader>

        {!pages ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>系统用户令牌 / 长期用户令牌</Label>
              <Textarea
                rows={4}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAA…"
                className="font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              在商务管理平台「商务设置 → 用户 → 系统用户」生成，需勾选 pages_show_list、
              pages_read_engagement、pages_manage_posts。令牌只用于换取主页凭证，不会被保存。
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={loadPages} disabled={token.trim().length < 20 || loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              {loading ? '读取中…' : '读取主页列表'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">选择要接入的主页：</p>
            {pages.map((p) => (
              <button
                key={p.pageId}
                type="button"
                onClick={() => pick(p)}
                className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50"
              >
                {p.avatar ? (
                  <img src={p.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.followers} 粉丝</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
