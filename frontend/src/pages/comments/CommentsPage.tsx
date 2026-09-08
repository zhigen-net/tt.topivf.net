import { useEffect, useMemo, useState } from 'react'
import {
  Search, ChevronLeft, ChevronRight, RefreshCw, Send, EyeOff, Undo2, CornerDownRight,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import { useWorkspace } from '@/lib/workspace'
import type { Comment, CommentStatus, PaginatedResponse } from '@/types'

const PAGE_SIZE = 20

const TABS: { value: CommentStatus; label: string }[] = [
  { value: 'pending', label: '待处理' },
  { value: 'replied', label: '已回复' },
  { value: 'ignored', label: '已忽略' },
  { value: 'all', label: '全部' },
]

export default function CommentsPage() {
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const canReply = can('member')

  const [status, setStatus] = useState<CommentStatus>('pending')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  // 同时只展开一条回复框，省得满屏都是输入框还互相抢注意力
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => setPage(1), [search, status])

  const params = useMemo(
    () => ({ status, ...(search ? { search } : {}), page, limit: PAGE_SIZE }),
    [status, search, page],
  )

  const { data, isLoading } = useQuery({
    queryKey: ['comments', params],
    queryFn: () => api.get<PaginatedResponse<Comment>>('/comments', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  function refresh() {
    qc.invalidateQueries({ queryKey: ['comments'] })
    qc.invalidateQueries({ queryKey: ['comments-pending'] })
  }

  const sync = useMutation({
    mutationFn: () => api.post<{ accounts: number; created: number }>('/comments/sync').then((r) => r.data),
    onSuccess: refresh,
  })

  const reply = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      api.post<Comment>(`/comments/${id}/reply`, { message }).then((r) => r.data),
    onSuccess: () => {
      setReplyingId(null)
      setDraft('')
      refresh()
    },
  })

  const ignore = useMutation({
    mutationFn: ({ id, ignored }: { id: string; ignored: boolean }) =>
      api.patch(`/comments/${id}/ignore`, { ignored }),
    onSuccess: refresh,
  })

  const comments = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  function openReply(c: Comment) {
    reply.reset()
    setReplyingId(c.id)
    setDraft('')
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">评论</h1>
          <p className="text-muted-foreground text-sm mt-1">
            共 {data?.total ?? 0} 条
            {sync.isSuccess && `，上次同步新增 ${sync.data.created} 条`}
          </p>
        </div>
        {canReply && (
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            <RefreshCw className={sync.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            <span className="hidden sm:inline">{sync.isPending ? '同步中…' : '同步'}</span>
          </Button>
        )}
      </div>

      {sync.isError && <p className="text-sm text-destructive">{errorText(sync.error)}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className={
              status === t.value
                ? 'rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground'
                : 'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded-md border bg-background px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="按评论内容搜索…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search ? '没有匹配的评论' : status === 'pending' ? '没有待处理的评论' : '还没有评论'}
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl border bg-background p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">{c.authorName ?? '匿名用户'}</span>
                <Badge variant="secondary" className="capitalize">{c.platform}</Badge>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  @{c.account?.username ?? c.accountId.slice(0, 8)}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                  {format(new Date(c.postedAt), 'yyyy-MM-dd HH:mm')}
                </span>
              </div>

              <p className="whitespace-pre-wrap break-words text-sm">{c.message}</p>

              {c.reply && (
                <div className="flex gap-2 rounded-lg bg-muted/50 p-3">
                  <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 space-y-1">
                    <p className="whitespace-pre-wrap break-words text-sm">{c.reply.message}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      已于 {format(new Date(c.reply.postedAt), 'yyyy-MM-dd HH:mm')} 回复
                    </p>
                  </div>
                </div>
              )}

              {replyingId === c.id ? (
                <div className="space-y-2">
                  <Textarea
                    autoFocus
                    rows={3}
                    placeholder={`以 @${c.account?.username ?? '该账号'} 的身份回复…`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    发出后会立刻公开显示在平台上，无法撤回。
                  </p>
                  {reply.isError && <p className="text-sm text-destructive">{errorText(reply.error)}</p>}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReplyingId(null)}
                      disabled={reply.isPending}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => reply.mutate({ id: c.id, message: draft.trim() })}
                      disabled={!draft.trim() || reply.isPending}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {reply.isPending ? '发送中…' : '发送'}
                    </Button>
                  </div>
                </div>
              ) : canReply && (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button size="sm" variant="outline" onClick={() => openReply(c)}>
                    <Send className="h-3.5 w-3.5" />
                    {c.repliedAt ? '再回一条' : '回复'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => ignore.mutate({ id: c.id, ignored: !c.ignoredAt })}
                    disabled={ignore.isPending}
                  >
                    {c.ignoredAt
                      ? <><Undo2 className="h-3.5 w-3.5" />放回待处理</>
                      : <><EyeOff className="h-3.5 w-3.5" />忽略</>}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
    </div>
  )
}

function errorText(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string | string[] } | undefined)?.message
    if (Array.isArray(msg)) return msg.join('；')
    if (msg) return msg
  }
  return '操作失败，请重试。'
}
