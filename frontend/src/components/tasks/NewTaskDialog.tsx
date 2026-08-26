import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 10)
    return d.toISOString().slice(0, 16)
  })

  const { data: contentsData } = useQuery({
    queryKey: ['contents'],
    queryFn: () => api.get<{ data: Content[] }>('/contents').then((r) => r.data),
    enabled: open,
  })

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: Account[] }>('/accounts').then((r) => r.data),
    enabled: open,
  })

  const contents = contentsData?.data ?? []
  const accounts = accountsData?.data ?? []

  const selectedContent = contents.find((c) => c.id === contentId)
  const allowedAccounts = selectedContent
    ? accounts.filter((a) => selectedContent.platforms.includes(a.platform))
    : accounts

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
    const d = new Date()
    d.setMinutes(d.getMinutes() + 10)
    setScheduledAt(d.toISOString().slice(0, 16))
    onClose()
  }

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Publish Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Select value={contentId} onValueChange={setContentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select content…" />
              </SelectTrigger>
              <SelectContent>
                {contents.length === 0 ? (
                  <SelectItem value="_empty" disabled>No content available</SelectItem>
                ) : (
                  contents.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Target Accounts {selectedAccounts.length > 0 && <span className="text-muted-foreground">({selectedAccounts.length} selected)</span>}</Label>
            {allowedAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {contentId ? "No accounts match this content's platforms." : 'No accounts available.'}
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                {allowedAccounts.map((a) => (
                  <label key={a.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(a.id)}
                      onChange={() => toggleAccount(a.id)}
                      className="h-4 w-4 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{a.displayName}</span>
                      <span className="text-xs text-muted-foreground ml-1 capitalize">· {a.platform}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Scheduled Time</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>

          {mutation.isError && <p className="text-sm text-destructive">Failed to create task. Please try again.</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!contentId || selectedAccounts.length === 0 || mutation.isPending}
          >
            {mutation.isPending ? 'Creating…' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
