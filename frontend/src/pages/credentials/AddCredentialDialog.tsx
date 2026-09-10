import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2, Stethoscope } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { TOKEN_HINT } from './credential-labels'
import { CredentialGuide, type GuideSectionId } from './CredentialGuide'
import { CredentialError, TokenPreflightPanel } from './TokenPreflight'
import type { DiscoveredTarget, MetaCredential, TokenReport } from '@/types'
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
  const [guide, setGuide] = useState<GuideSectionId | 'closed'>('closed')
  const selection = useTargetSelection()

  useEffect(() => {
    if (open) return
    setLabel('')
    setToken('')
    setCreated(null)
    setGuide('closed')
    selection.reset()
  }, [open])

  const openGuide = (section: GuideSectionId) => setGuide(section)

  const inspect = useMutation({
    mutationFn: () => api.post<TokenReport>('/credentials/inspect', { token: token.trim() })
      .then((r) => r.data),
  })

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
    mutationFn: () => api.post<{ created: number; adopted: string[] }>(
      `/credentials/${created?.credential.id}/link`,
      { targets: selection.chosen(created?.targets ?? []) },
    ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['credentials'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      const { created: n, adopted } = res.data
      if (adopted.length) {
        alert(`新建 ${n} 个账号；另有 ${adopted.length} 个早先手动添加的账号已归到这条凭证下：${adopted.join('、')}`)
      }
      onClose()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={guide === 'closed' ? 'max-w-lg' : 'max-w-2xl'}>
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
                onChange={(e) => {
                  setToken(e.target.value)
                  // 换了令牌，上一条的体检结论就作废了，留着会误导
                  inspect.reset()
                  create.reset()
                }}
                placeholder="EAA…"
                className="font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">{TOKEN_HINT}</p>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => inspect.mutate()}
                disabled={token.trim().length < 20 || inspect.isPending}
              >
                {inspect.isPending
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <Stethoscope className="h-3.5 w-3.5 mr-1.5" />}
                先体检一下
              </Button>
              <button
                type="button"
                onClick={() => setGuide(guide === 'closed' ? 'choose' : 'closed')}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {guide === 'closed'
                  ? <ChevronRight className="h-3.5 w-3.5" />
                  : <ChevronDown className="h-3.5 w-3.5" />}
                令牌怎么拿？看接入指引
              </button>
            </div>

            {inspect.data && <TokenPreflightPanel report={inspect.data} onJump={openGuide} />}
            {inspect.isError && <CredentialError err={inspect.error} onJump={openGuide} />}
            {create.isError && <CredentialError err={create.error} onJump={openGuide} />}

            {guide !== 'closed' && (
              <div className="max-h-80 overflow-y-auto rounded-md border p-3">
                <CredentialGuide focus={guide === 'choose' ? undefined : guide} />
              </div>
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
