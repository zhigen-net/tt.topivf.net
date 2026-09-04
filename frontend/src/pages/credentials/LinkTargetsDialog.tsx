import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { TargetPicker, useTargetSelection } from './TargetPicker'
import { errorText } from './AddCredentialDialog'
import type { DiscoveredTarget, MetaCredential } from '@/types'

interface LinkResult {
  created: number
  /** 早先手动添加、这次被归到凭证下的账号名 */
  adopted: string[]
  skipped: string[]
}

/** 用已存的令牌重新拉一次名下账号，勾选后批量接入 */
export function LinkTargetsDialog({ credential, onClose }: {
  credential: MetaCredential | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const selection = useTargetSelection()

  const discover = useMutation({
    mutationFn: (id: string) => api.post<DiscoveredTarget[]>(`/credentials/${id}/discover`),
    onSuccess: (res) => selection.selectAll(res.data),
  })

  const link = useMutation({
    mutationFn: () => api.post<LinkResult>(`/credentials/${credential?.id}/link`, {
      targets: selection.chosen(discover.data?.data ?? []),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['credentials'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      const { created, adopted } = res.data
      // 认领是静默改已有账号，不说一声用户会以为没接入成功
      if (adopted.length) {
        alert(`新建 ${created} 个账号；另有 ${adopted.length} 个早先手动添加的账号已归到这条凭证下：${adopted.join('、')}`)
      }
      onClose()
    },
  })

  useEffect(() => {
    selection.reset()
    discover.reset()
    link.reset()
    if (credential) discover.mutate(credential.id)
  }, [credential?.id])

  return (
    <Dialog open={!!credential} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>接入账号 · {credential?.label}</DialogTitle>
        </DialogHeader>

        {discover.isPending ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取该凭证名下的主页…
          </p>
        ) : discover.isError ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorText(discover.error)}
          </p>
        ) : (
          <TargetPicker targets={discover.data?.data ?? []} selection={selection} />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => link.mutate()} disabled={!selection.count || link.isPending}>
            {link.isPending ? '接入中…' : `接入选中的 ${selection.count} 个`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
