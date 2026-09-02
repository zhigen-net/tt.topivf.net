import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { platformLabel } from './constants'
import { api } from '@/lib/api'
import type { Account, Content, Platform } from '@/types'

interface Props {
  contents: Content[]
  onClose: () => void
  onPublished: () => void
}

export function PublishContentDialog({ contents, onClose, onPublished }: Props) {
  const qc = useQueryClient()
  const open = contents.length > 0
  const [selected, setSelected] = useState<string[]>([])
  const [immediate, setImmediate] = useState(true)
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule)

  useEffect(() => {
    if (!open) return
    setSelected([])
    setImmediate(true)
    setScheduledAt(defaultSchedule())
  }, [open, contents])

  const { data } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: Account[] }>('/accounts').then((r) => r.data),
    enabled: open,
  })

  const platforms = useMemo(
    () => [...new Set(contents.flatMap((c) => c.platforms))] as Platform[],
    [contents],
  )

  const accounts = data?.data ?? []
  // 只有内容声明过的平台才发得出去，其它账号列出来只会误导
  const candidates = accounts.filter((a) => platforms.includes(a.platform))
  const inactiveSelected = candidates.filter((a) => selected.includes(a.id) && a.status !== 'active')

  // 多选时每个作品的目标平台可能不同，后端会按平台裁剪账号，这里先算出会被跳过的
  const unmatched = contents.filter(
    (c) => !candidates.some((a) => selected.includes(a.id) && c.platforms.includes(a.platform)),
  )

  const mutation = useMutation({
    mutationFn: () => {
      const at = immediate ? new Date().toISOString() : new Date(scheduledAt).toISOString()
      if (contents.length === 1) {
        const picked = candidates.filter((a) => selected.includes(a.id) && contents[0].platforms.includes(a.platform))
        return api.post('/tasks', {
          contentId: contents[0].id,
          accountIds: picked.map((a) => a.id),
          platforms: [...new Set(picked.map((a) => a.platform))],
          scheduledAt: at,
        })
      }
      return api.post('/tasks/bulk', {
        contentIds: contents.map((c) => c.id),
        accountIds: selected,
        scheduledAt: at,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['contents'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      onPublished()
    },
  })

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const willPublish = contents.length - unmatched.length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contents.length > 1 ? `批量发布 ${contents.length} 个作品` : '发布作品'}</DialogTitle>
        </DialogHeader>

        {open && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              {contents.length === 1 ? (
                <p className="text-sm font-medium truncate">{contents[0].title}</p>
              ) : (
                <p className="text-sm font-medium truncate">
                  {contents.slice(0, 3).map((c) => c.title).join('、')}
                  {contents.length > 3 && ` 等 ${contents.length} 个`}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                目标平台：{platforms.map((p) => platformLabel[p]).join('、')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>
                选择账号
                {selected.length > 0 && <span className="text-muted-foreground"> （已选 {selected.length} 个）</span>}
              </Label>
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  没有匹配这些作品目标平台的账号，请先添加账号或调整作品的目标平台。
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                  {candidates.map((a) => (
                    <label key={a.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={selected.includes(a.id)}
                        onChange={() => toggle(a.id)}
                        className="h-4 w-4 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{a.displayName}</span>
                        <span className="text-xs text-muted-foreground ml-1">· {platformLabel[a.platform]}</span>
                      </div>
                      {a.status !== 'active' && (
                        <span className="text-xs text-amber-600 shrink-0">未启用</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>发布时间</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setImmediate(true)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                    immediate ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground hover:bg-accent'
                  }`}
                >
                  立即发布
                </button>
                <button
                  type="button"
                  onClick={() => setImmediate(false)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                    !immediate ? 'bg-primary text-primary-foreground border-primary' : 'border-input text-muted-foreground hover:bg-accent'
                  }`}
                >
                  定时发布
                </button>
              </div>
              {!immediate && (
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              )}
            </div>

            {selected.length > 0 && unmatched.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
                <span>
                  {unmatched.length} 个作品的目标平台和已选账号对不上，会被跳过：
                  {unmatched.slice(0, 3).map((c) => c.title).join('、')}
                  {unmatched.length > 3 && ' …'}
                </span>
              </div>
            )}

            {inactiveSelected.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
                <span>
                  已选中 {inactiveSelected.length} 个未启用的账号，凭证可能已失效，发布大概率会失败。
                </span>
              </div>
            )}

            {mutation.isError && <p className="text-sm text-destructive">创建发布任务失败，请重试。</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>取消</Button>
          <Button onClick={() => mutation.mutate()} disabled={willPublish === 0 || mutation.isPending}>
            {mutation.isPending ? '提交中…' : immediate ? `立即发布${contents.length > 1 ? ` ${willPublish} 个` : ''}` : '创建定时任务'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function defaultSchedule(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 10)
  // datetime-local 要本地时间，toISOString 会偏移成 UTC
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
