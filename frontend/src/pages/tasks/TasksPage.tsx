import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NewTaskDialog } from '@/components/tasks/NewTaskDialog'
import { api } from '@/lib/api'
import type { PublishTask, TaskStatus } from '@/types'

const statusVariant: Record<TaskStatus, 'default' | 'success' | 'destructive' | 'secondary'> = {
  pending: 'secondary',
  running: 'default',
  done: 'success',
  failed: 'destructive',
}

export default function TasksPage() {
  const qc = useQueryClient()
  const [newOpen, setNewOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get<{ data: PublishTask[]; total: number }>('/tasks').then((r) => r.data),
    refetchInterval: 10_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const tasks = data?.data ?? []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Publish Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} tasks total</p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Content</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Platforms</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Accounts</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Scheduled</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Results</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No tasks yet.</td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{task.content?.title ?? task.contentId.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {task.platforms.map((p) => (
                        <span key={p} className="text-xs text-muted-foreground capitalize">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{task.accountIds.length} accounts</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(task.scheduledAt), 'MMM d, HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[task.status]}>{task.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {task.results.length > 0
                      ? `${task.results.filter((r) => r.success).length}/${task.results.length} ok`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(task.id)}
                      disabled={deleteMutation.isPending || task.status === 'running'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <NewTaskDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}
