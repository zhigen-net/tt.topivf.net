import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import type { Content } from '@/types'

interface Props {
  contents: Content[]
  onClose: () => void
  onDone: () => void
}

export function RejectContentDialog({ contents, onClose, onDone }: Props) {
  const qc = useQueryClient()
  const open = contents.length > 0
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) setNote('')
  }, [open, contents])

  const mutation = useMutation({
    mutationFn: (): Promise<unknown> => {
      if (contents.length === 1) {
        return api.post(`/contents/${contents[0].id}/review`, { action: 'reject', note })
      }
      return api.post('/contents/bulk-review', {
        ids: contents.map((c) => c.id),
        action: 'reject',
        note,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contents'] })
      onDone()
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{contents.length > 1 ? `驳回 ${contents.length} 个作品` : '驳回作品'}</DialogTitle>
        </DialogHeader>

        {open && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              {contents.slice(0, 3).map((c) => c.title).join('、')}
              {contents.length > 3 && ` 等 ${contents.length} 个`}
            </div>
            <div className="space-y-1.5">
              <Label>驳回理由</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="说明需要修改的地方，作者会在列表里看到"
              />
            </div>
            {mutation.isError && <p className="text-sm text-destructive">驳回失败，请重试。</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>取消</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!note.trim() || mutation.isPending}
          >
            {mutation.isPending ? '提交中…' : '确认驳回'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
