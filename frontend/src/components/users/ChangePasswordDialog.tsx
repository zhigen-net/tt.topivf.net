import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

interface Props {
  open: boolean
  onClose: () => void
}

export function ChangePasswordDialog({ open, onClose }: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    setCurrent(''); setNext(''); setConfirm(''); setDone(false)
  }, [open])

  const mutation = useMutation({
    mutationFn: () => api.patch('/users/me/password', { currentPassword: current, password: next }),
    onSuccess: () => setDone(true),
  })

  const mismatch = confirm.length > 0 && next !== confirm
  const valid = next.length >= 8 && next === confirm && current.length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
        </DialogHeader>

        {done ? (
          <p className="text-sm text-emerald-600">密码已更新，下次登录请使用新密码。</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>当前密码</Label>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label>新密码</Label>
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">至少 8 位</p>
            </div>
            <div className="space-y-1.5">
              <Label>确认新密码</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              {mismatch && <p className="text-xs text-destructive">两次输入不一致</p>}
            </div>
            {mutation.isError && <p className="text-sm text-destructive">{errorText(mutation.error)}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {done ? '关闭' : '取消'}
          </Button>
          {!done && (
            <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
              {mutation.isPending ? '提交中…' : '确认修改'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function errorText(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string | string[] } | undefined)?.message
    if (Array.isArray(msg)) return msg.join('；')
    if (msg) return msg
  }
  return '修改失败，请重试。'
}
