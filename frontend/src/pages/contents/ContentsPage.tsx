import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Upload, Trash2, Pencil, Send, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlatformBadge } from '@/components/PlatformBadge'
import { ContentFormDialog } from '@/components/contents/ContentFormDialog'
import { PublishContentDialog } from '@/components/contents/PublishContentDialog'
import { allContentTypes, allPlatforms, contentTypeLabel, platformLabel } from '@/components/contents/constants'
import { api } from '@/lib/api'
import type { Content, ContentType, PaginatedResponse, Platform } from '@/types'

const ALL = '__all__'
const PAGE_SIZE = 12

type SortKey = 'newest' | 'oldest' | 'updated' | 'title'

const sortOptions: { value: SortKey; label: string; sort: string; order: 'ASC' | 'DESC' }[] = [
  { value: 'newest', label: '最新创建', sort: 'createdAt', order: 'DESC' },
  { value: 'oldest', label: '最早创建', sort: 'createdAt', order: 'ASC' },
  { value: 'updated', label: '最近修改', sort: 'updatedAt', order: 'DESC' },
  { value: 'title', label: '标题 A→Z', sort: 'title', order: 'ASC' },
]

export default function ContentsPage() {
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState<ContentType | typeof ALL>(ALL)
  const [platform, setPlatform] = useState<Platform | typeof ALL>(ALL)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Content | null>(null)
  const [publishing, setPublishing] = useState<Content | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // 每敲一个字就打一次接口没必要，停下来再查
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => setPage(1), [search, type, platform, sortKey])

  const sortConfig = sortOptions.find((o) => o.value === sortKey)!
  const params = useMemo(() => ({
    ...(search ? { search } : {}),
    ...(type !== ALL ? { type } : {}),
    ...(platform !== ALL ? { platform } : {}),
    sort: sortConfig.sort,
    order: sortConfig.order,
    page,
    limit: PAGE_SIZE,
  }), [search, type, platform, sortConfig, page])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['contents', params],
    queryFn: () => api.get<PaginatedResponse<Content>>('/contents', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contents/${id}`),
    onSuccess: () => {
      setConfirmDelete(null)
      qc.invalidateQueries({ queryKey: ['contents'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const contents = data?.data ?? []
  const totalPages = data?.totalPages ?? 1
  const hasFilters = Boolean(search) || type !== ALL || platform !== ALL

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(item: Content) {
    setEditing(item)
    setFormOpen(true)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">作品管理</h1>
          <p className="text-muted-foreground text-sm mt-1">共 {data?.total ?? 0} 个作品</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新建作品
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-md border bg-background px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="搜索标题或文案…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <Select value={type} onValueChange={(v) => setType(v as ContentType | typeof ALL)}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部类型</SelectItem>
            {allContentTypes.map((t) => (
              <SelectItem key={t} value={t}>{contentTypeLabel[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={platform} onValueChange={(v) => setPlatform(v as Platform | typeof ALL)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部平台</SelectItem>
            {allPlatforms.map((p) => (
              <SelectItem key={p} value={p}>{platformLabel[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sortOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => { setSearchInput(''); setType(ALL); setPlatform(ALL) }}
          >
            清除筛选
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-muted/30 aspect-video animate-pulse" />
          ))}
        </div>
      ) : contents.length === 0 ? (
        <div className="rounded-xl border border-dashed p-16 text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {hasFilters ? '没有匹配的作品，试试放宽筛选条件。' : '还没有作品，先添加第一个视频或图片。'}
          </p>
          {!hasFilters && (
            <Button variant="outline" className="mt-4" onClick={openCreate}>新建作品</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {contents.map((item) => (
            <div key={item.id} className="rounded-xl border overflow-hidden hover:shadow-md transition-shadow group relative flex flex-col">
              <div className="aspect-video bg-muted shrink-0">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.title} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs uppercase tracking-wide">
                    {contentTypeLabel[item.type]}
                  </div>
                )}
              </div>

              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <IconAction title="发布" onClick={() => setPublishing(item)}>
                  <Send className="h-3.5 w-3.5" />
                </IconAction>
                <IconAction title="编辑" onClick={() => openEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconAction>
                <IconAction title="删除" destructive onClick={() => setConfirmDelete(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconAction>
              </div>

              <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                <p className="text-sm font-medium truncate" title={item.title}>{item.title}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{contentTypeLabel[item.type]}</Badge>
                  {item.platforms.slice(0, 2).map((p) => <PlatformBadge key={p} platform={p} />)}
                  {item.platforms.length > 2 && (
                    <span className="text-xs text-muted-foreground">+{item.platforms.length - 2}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-auto pt-1">
                  <PublishState item={item} />
                </div>
              </div>

              {confirmDelete === item.id && (
                <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center gap-3 p-4 text-center">
                  <p className="text-sm">删除后关联的发布任务也会一并消失，确定删除？</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>取消</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? '删除中…' : '确定删除'}
                    </Button>
                  </div>
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

      <ContentFormDialog open={formOpen} content={editing} onClose={() => setFormOpen(false)} />
      <PublishContentDialog
        content={publishing}
        onClose={() => setPublishing(null)}
        onPublished={() => setPublishing(null)}
      />
    </div>
  )
}

function IconAction({ title, destructive, onClick, children }: {
  title: string
  destructive?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-6 w-6 rounded-md bg-background/90 border flex items-center justify-center transition-colors ${
        destructive ? 'hover:bg-destructive hover:text-white' : 'hover:bg-accent'
      }`}
    >
      {children}
    </button>
  )
}

function PublishState({ item }: { item: Content }) {
  if (item.taskCount === 0) return <span>未发布</span>
  if (item.lastPublishedAt) {
    return (
      <span className="text-emerald-600">
        已发布 · {formatTime(item.lastPublishedAt)}
        {item.failedCount > 0 && <span className="text-destructive"> · {item.failedCount} 次失败</span>}
      </span>
    )
  }
  if (item.failedCount > 0) return <span className="text-destructive">{item.failedCount} 次发布失败</span>
  return <span>{item.taskCount} 个任务待发布</span>
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
