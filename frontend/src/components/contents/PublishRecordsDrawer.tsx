import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { TaskResultList } from '@/components/tasks/TaskResultList'
import { taskStatusLabel, taskStatusVariant } from '@/components/tasks/constants'
import { api } from '@/lib/api'
import type { Content, PaginatedResponse, PublishTask } from '@/types'

const PAGE_SIZE = 50

export function PublishRecordsDrawer({ content, onClose }: { content: Content | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'by-content', content?.id],
    queryFn: () => api
      .get<PaginatedResponse<PublishTask>>('/tasks', { params: { contentId: content!.id, limit: PAGE_SIZE } })
      .then((r) => r.data),
    enabled: !!content,
    // 还在跑的任务结果是逐条写回的，抽屉开着就跟着刷
    refetchInterval: (q) => q.state.data?.data.some((t) => t.status === 'pending' || t.status === 'running') ? 5_000 : false,
  })

  const tasks = data?.data ?? []

  return (
    <Drawer open={!!content} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>发布记录</DrawerTitle>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{content?.title}</p>
        </DrawerHeader>

        <DrawerBody>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl border bg-muted/30 animate-pulse" />
            ))
          ) : tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              这个作品还没有发布过。
            </p>
          ) : (
            <>
              {data && data.total > tasks.length && (
                <p className="text-xs text-muted-foreground">
                  共 {data.total} 次发布，只列出最近 {tasks.length} 次。
                </p>
              )}
              {tasks.map((task) => (
                <div key={task.id} className="rounded-xl border p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      <p className="tabular-nums">
                        发起 {format(new Date(task.createdAt), 'yyyy-MM-dd HH:mm')}
                      </p>
                      {task.completedAt && (
                        <p className="tabular-nums">
                          完成 {format(new Date(task.completedAt), 'yyyy-MM-dd HH:mm')}
                        </p>
                      )}
                    </div>
                    <Badge variant={taskStatusVariant[task.status]}>{taskStatusLabel[task.status]}</Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {task.results.filter((r) => r.success).length}/{task.accountIds.length} 个账号发布成功
                  </p>

                  <TaskResultList task={task} />
                </div>
              ))}
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
