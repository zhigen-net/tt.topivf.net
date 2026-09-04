import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { PlatformBadge } from '@/components/PlatformBadge'
import { TaskResultList } from './TaskResultList'
import { taskStatusLabel, taskStatusVariant } from './constants'
import type { PublishTask } from '@/types'

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
          <DialogTitle>任务详情</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{task.content?.title ?? task.contentId}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                计划 {format(new Date(task.scheduledAt), 'yyyy-MM-dd HH:mm')}
                {task.completedAt && ` · 完成于 ${format(new Date(task.completedAt), 'HH:mm')}`}
              </p>
            </div>
            <Badge variant={taskStatusVariant[task.status]}>{taskStatusLabel[task.status]}</Badge>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">目标平台</p>
            <div className="flex gap-1 flex-wrap">
              {task.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              执行结果（{task.results.filter((r) => r.success).length}/{task.accountIds.length} 成功）
            </p>

            <TaskResultList task={task} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
