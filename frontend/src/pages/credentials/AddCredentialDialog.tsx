import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { TOKEN_HINT } from './credential-labels'
import type { DiscoveredTarget, MetaCredential } from '@/types'
import { TargetPicker, useTargetSelection } from './TargetPicker'

interface CreateResult {
  credential: MetaCredential
  targets: DiscoveredTarget[]
}

export function AddCredentialDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [label, setLabel] = useState('')
  const [token, setToken] = useState('')
  const [created, setCreated] = useState<CreateResult | null>(null)
  const selection = useTargetSelection()

  useEffect(() => {
    if (open) return
    setLabel('')
    setToken('')
    setCreated(null)
    selection.reset()
  }, [open])

  const create = useMutation({
    mutationFn: () => api.post<CreateResult>('/credentials', { label: label.trim(), token: token.trim() }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['credentials'] })
      setToken('') // 令牌已经加密存到后端了，前端不留副本
      setCreated(res.data)
      selection.selectAll(res.data.targets)
    },
  })

  const link = useMutation({
    mutationFn: () => api.post(`/credentials/${created?.credential.id}/link`, {
      targets: selection.chosen(created?.targets ?? []),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credentials'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{created ? '选择要接入的账号' : '添加授权凭证'}</DialogTitle>
        </DialogHeader>

        {!created ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>凭证名称</Label>
              <Input
                placeholder="例如：XX公司商务管理平台"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
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
            <p className="text-xs text-muted-foreground">{TOKEN_HINT}</p>
            {create.isError && (
              <p className="text-sm text-destructive">
                {errorText(create.error)}
              </p>
            )}
          </div>
        ) : (
          <TargetPicker targets={created.targets} selection={selection} />
        )}

        <DialogFooter>
          {!created ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={create.isPending}>取消</Button>
              <Button
                onClick={() => create.mutate()}
                disabled={!label.trim() || token.trim().length < 20 || create.isPending}
              >
                {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {create.isPending ? '校验中…' : '读取名下账号'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>稍后再接入</Button>
              <Button
                onClick={() => link.mutate()}
                disabled={!selection.count || link.isPending}
              >
                {link.isPending ? '接入中…' : `接入选中的 ${selection.count} 个`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function errorText(err: unknown): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  if (Array.isArray(message)) return message.join('；')
  return typeof message === 'string' ? message : '操作失败，请重试'
}
