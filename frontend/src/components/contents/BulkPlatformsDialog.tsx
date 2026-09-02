import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { allPlatforms, platformLabel } from './constants'
import { api } from '@/lib/api'
import type { Platform } from '@/types'

interface Props {
  open: boolean
  ids: string[]
  onClose: () => void
  onDone: () => void
}

export function BulkPlatformsDialog({ open, ids, onClose, onDone }: Props) {
  const qc = useQueryClient()
  const [platforms, setPlatforms] = useState<Platform[]>([])

  useEffect(() => {
    if (open) setPlatforms([])
  }, [open])

  const mutation = useMutation({
    mutationFn: () => api.post('/contents/bulk-platforms', { ids, platforms }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contents'] })
      onDone()
    },
  })

  function toggle(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>修改目标平台</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            选中的 {ids.length} 个作品的目标平台会被<span className="text-foreground font-medium">整体替换</span>成下面勾选的平台。
          </p>
          <div className="flex flex-wrap gap-2">
            {allPlatforms.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => toggle(p)}
                className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${
                  platforms.includes(p)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input text-muted-foreground hover:bg-accent'
                }`}
              >
                {platformLabel[p]}
              </button>
            ))}
          </div>
          {mutation.isError && <p className="text-sm text-destructive">修改失败，请重试。</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>取消</Button>
          <Button onClick={() => mutation.mutate()} disabled={platforms.length === 0 || mutation.isPending}>
            {mutation.isPending ? '保存中…' : '确定替换'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
