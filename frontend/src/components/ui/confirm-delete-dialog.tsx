import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  title: string
  description: ReactNode
  pending?: boolean
  /** 传 mutation.error 即可，组件自己取后端返回的 message */
  error?: unknown
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDeleteDialog({ open, title, description, pending, error, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="text-sm">{description}</div>
        {!!error && <p className="text-sm text-destructive">{messageOf(error)}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>取消</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? '删除中…' : '确定删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function messageOf(err: unknown): string {
  const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  if (Array.isArray(m)) return m.join('；')
  return typeof m === 'string' ? m : '删除失败，请重试'
}
