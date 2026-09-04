import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { TOKEN_HINT } from './credential-labels'
import { errorText } from './AddCredentialDialog'
import type { MetaCredential } from '@/types'

interface RotateResult {
  updated: number
  orphaned: string[]
}

/** 令牌到期或补了权限后走这里，按 externalId 匹配批量更新，不用逐个账号重绑 */
export function RotateTokenDialog({ credential, onClose }: {
  credential: MetaCredential | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [token, setToken] = useState('')
  const [result, setResult] = useState<RotateResult | null>(null)

  useEffect(() => {
    setToken('')
    setResult(null)
  }, [credential?.id])

  const rotate = useMutation({
    mutationFn: () => api.post<RotateResult>(`/credentials/${credential?.id}/rotate`, {
      token: token.trim(),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['credentials'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setToken('')
      setResult(res.data)
    },
  })

  return (
    <Dialog open={!!credential} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>更换令牌 · {credential?.label}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm">
              已更新 {result.updated} 个账号的主页凭证。
            </p>
            {result.orphaned.length > 0 && (
              <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm space-y-1">
                <p className="font-medium">这些账号在新令牌下找不到，凭证未更新：</p>
                <p className="text-muted-foreground">{result.orphaned.join('、')}</p>
                <p className="text-xs text-muted-foreground">
                  通常是对应主页没有分配给新的系统用户，或者已被移出商务管理平台。
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              新令牌会替换掉存着的这条，并按平台账号 id 自动匹配，批量刷新
              {credential?.accountCount ?? 0} 个已接入账号的主页凭证。
            </p>
            <div className="space-y-1.5">
              <Label>新的系统用户令牌 / 长期用户令牌</Label>
              <Textarea
                rows={4}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAA…"
                className="font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">{TOKEN_HINT}</p>
            {rotate.isError && (
              <p className="text-sm text-destructive">{errorText(rotate.error)}</p>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={onClose}>知道了</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={rotate.isPending}>取消</Button>
              <Button onClick={() => rotate.mutate()} disabled={token.trim().length < 20 || rotate.isPending}>
                {rotate.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {rotate.isPending ? '更换中…' : '确认更换'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
