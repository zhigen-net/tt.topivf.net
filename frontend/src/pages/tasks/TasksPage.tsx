import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { NewTaskDialog } from '@/components/tasks/NewTaskDialog'
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog'
import { taskStatusLabel, taskStatusVariant as statusVariant } from '@/components/tasks/constants'
import { api } from '@/lib/api'
import type { PaginatedResponse, PublishTask } from '@/types'

const PAGE_SIZE = 20

export default function TasksPage() {
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [newOpen, setNewOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<PublishTask | null>(null)
  const [removing, setRemoving] = useState<PublishTask | null>(null)

  // 每敲一个字就打一次接口没必要，停下来再查
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => setPage(1), [search])

  const params = useMemo(
    () => ({ ...(search ? { search } : {}), page, limit: PAGE_SIZE }),
    [search, page],
  )

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.get<PaginatedResponse<PublishTask>>('/tasks', { params }).then((r) => r.data),
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setRemoving(null)
    },
  })

  const tasks = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  function deleteButton(task: PublishTask) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        title={task.status === 'running' ? '执行中不能删除' : '删除'}
        onClick={() => { deleteMutation.reset(); setRemoving(task) }}
        disabled={deleteMutation.isPending || task.status === 'running'}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    )
  }

  function resultText(task: PublishTask) {
    return task.results.length > 0
      ? `${task.results.filter((r) => r.success).length}/${task.results.length} 成功`
      : '—'
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">发布任务</h1>
          <p className="text-muted-foreground text-sm mt-1">共 {data?.total ?? 0} 个任务</p>
        </div>
        <Button className="shrink-0" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">新建任务</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded-md border bg-background px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="按作品标题搜索…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
      ) : tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search ? '没有匹配的任务' : '还没有任务'}
        </p>
      ) : (
        <div className="space-y-2 md:hidden">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl border bg-background p-3 space-y-2.5">
              <div className="flex items-start gap-2" onClick={() => setSelectedTask(task)}>
                <p className="min-w-0 flex-1 break-words font-medium text-sm">
                  {task.content?.title ?? task.contentId.slice(0, 8)}
                </p>
                <Badge variant={statusVariant[task.status]}>{taskStatusLabel[task.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {task.platforms.join('、') || '—'} · {task.accountIds.length} 个账号 · {resultText(task)}
              </p>
              <div className="flex items-center justify-between gap-2 border-t pt-2">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  计划 {format(new Date(task.scheduledAt), 'MM-dd HH:mm')}
                </span>
                <div className="shrink-0">{deleteButton(task)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="hidden md:block rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">作品</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">平台</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">账号</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">计划时间</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">结果</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">加载中…</td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {search ? '没有匹配的任务' : '还没有任务'}
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelectedTask(task)}>
                  <td className="px-4 py-3 font-medium">{task.content?.title ?? task.contentId.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {task.platforms.map((p) => (
                        <span key={p} className="text-xs text-muted-foreground capitalize">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{task.accountIds.length} 个</td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {format(new Date(task.scheduledAt), 'MM-dd HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[task.status]}>{taskStatusLabel[task.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{resultText(task)}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {deleteButton(task)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">第 {page} / {totalPages} 页</span>
          <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <NewTaskDialog open={newOpen} onClose={() => setNewOpen(false)} />
      <TaskDetailDialog task={selectedTask} onClose={() => setSelectedTask(null)} />
      <ConfirmDeleteDialog
        open={!!removing}
        title="删除任务"
        description={`删除「${removing?.content?.title ?? '这条任务'}」后，执行结果和发布链接一并消失，已经发到平台上的内容不受影响。确定删除？`}
        pending={deleteMutation.isPending}
        error={deleteMutation.error}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && deleteMutation.mutate(removing.id)}
      />
    </div>
  )
}
