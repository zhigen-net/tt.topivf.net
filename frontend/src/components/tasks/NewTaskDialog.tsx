import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AccountPicker, usePublishHistory } from '@/components/accounts/AccountPicker'
import { api } from '@/lib/api'
import type { Account, Content } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

export function NewTaskDialog({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [contentId, setContentId] = useState('')
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule)

  // 只有审核通过的作品能建任务，其它列出来只会在提交时被后端打回
  const { data: contentsData } = useQuery({
    queryKey: ['contents', { reviewStatus: 'approved' }],
    queryFn: () => api.get<{ data: Content[] }>('/contents', {
      params: { reviewStatus: 'approved', limit: 200 },
    }).then((r) => r.data),
    enabled: open,
  })

  // 列表页那份是分页的（默认 20 条），选账号得把全部拿回来
  const { data: accountsData } = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => api.get<{ data: Account[] }>('/accounts', { params: { limit: 500 } }).then((r) => r.data),
    enabled: open,
  })

  const contents = contentsData?.data ?? []
  const accounts = accountsData?.data ?? []

  const selectedContent = contents.find((c) => c.id === contentId)
  const allowedAccounts = selectedContent
    ? accounts.filter((a) => selectedContent.platforms.includes(a.platform))
    : accounts

  const history = usePublishHistory(contentId || undefined, open)

  const mutation = useMutation({
    mutationFn: () => {
      const accountObjs = accounts.filter((a) => selectedAccounts.includes(a.id))
      const platforms = [...new Set(accountObjs.map((a) => a.platform))]
      return api.post('/tasks', {
        contentId,
        accountIds: selectedAccounts,
        platforms,
        scheduledAt: new Date(scheduledAt).toISOString(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      handleClose()
    },
  })

  function handleClose() {
    setContentId('')
    setSelectedAccounts([])
    setScheduledAt(defaultSchedule())
    onClose()
  }

  function pickContent(id: string) {
    setContentId(id)
    // 换了作品，可选平台跟着变，旧的勾选留着会带上发不出去的账号
    setSelectedAccounts([])
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新建发布任务</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>作品</Label>
            <Select value={contentId} onValueChange={pickContent}>
              <SelectTrigger>
                <SelectValue placeholder="选择作品…" />
              </SelectTrigger>
              <SelectContent>
                {contents.length === 0 ? (
                  <SelectItem value="_empty" disabled>没有审核通过的作品</SelectItem>
                ) : (
                  contents.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              目标账号
              {selectedAccounts.length > 0 && <span className="text-muted-foreground"> （已选 {selectedAccounts.length} 个）</span>}
            </Label>
            <AccountPicker
              key={contentId}
              accounts={allowedAccounts}
              selected={selectedAccounts}
              onChange={setSelectedAccounts}
              history={history}
              emptyHint={contentId ? '没有匹配该作品目标平台的账号。' : '还没有账号。'}
            />
          </div>

          <div className="space-y-1.5">
            <Label>发布时间</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          {mutation.isError && <p className="text-sm text-destructive">创建任务失败，请重试。</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>取消</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!contentId || selectedAccounts.length === 0 || mutation.isPending}
          >
            {mutation.isPending ? '创建中…' : '创建任务'}
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
