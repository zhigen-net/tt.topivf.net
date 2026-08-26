import { format } from 'date-fns'
import { CheckCircle2, XCircle, Clock, Loader2, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { PlatformBadge } from '@/components/PlatformBadge'
import type { PublishTask, TaskStatus } from '@/types'

const statusVariant: Record<TaskStatus, 'default' | 'success' | 'destructive' | 'secondary'> = {
  pending: 'secondary',
  running: 'default',
  done: 'success',
  failed: 'destructive',
}

interface Props {
  task: PublishTask | null
  onClose: () => void
}

export function TaskDetailDialog({ task, onClose }: Props) {
  if (!task) return null

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Task Detail</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{task.content?.title ?? task.contentId}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Scheduled {format(new Date(task.scheduledAt), 'MMM d, yyyy HH:mm')}
                {task.completedAt && ` · Completed ${format(new Date(task.completedAt), 'HH:mm')}`}
              </p>
            </div>
            <Badge variant={statusVariant[task.status]}>{task.status}</Badge>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Platforms</p>
            <div className="flex gap-1 flex-wrap">
              {task.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Results ({task.results.filter((r) => r.success).length}/{task.accountIds.length} succeeded)
            </p>

            {task.results.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                {task.status === 'pending' ? (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-5 w-5" />
                    <p className="text-sm">Waiting to be processed…</p>
                  </div>
                ) : task.status === 'running' ? (
                  <div className="flex flex-col items-center gap-1.5 text-blue-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="text-sm">Publishing in progress…</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No results recorded.</p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border divide-y overflow-hidden">
                {task.results.map((r) => (
                  <div key={r.accountId} className="flex items-center gap-3 px-3 py-2.5">
                    {r.success
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={r.platform} />
                        <span className="text-xs text-muted-foreground font-mono">{r.accountId.slice(0, 8)}</span>
                      </div>
                      {r.error && <p className="text-xs text-red-500 mt-0.5 truncate">{r.error}</p>}
                    </div>
                    {r.postUrl && (
                      <a href={r.postUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}

                {task.accountIds.filter((id) => !task.results.find((r) => r.accountId === id)).map((id) => (
                  <div key={id} className="flex items-center gap-3 px-3 py-2.5">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground font-mono">{id.slice(0, 8)} — pending</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
