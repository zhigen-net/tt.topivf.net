import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, Upload, Trash2, Pencil, Send, RefreshCw, ChevronLeft, ChevronRight, Tags, X, FileCheck, CheckCircle2, XCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlatformBadge } from '@/components/PlatformBadge'
import { ContentFormDialog } from '@/components/contents/ContentFormDialog'
import { PublishContentDialog } from '@/components/contents/PublishContentDialog'
import { BulkPlatformsDialog } from '@/components/contents/BulkPlatformsDialog'
import { RejectContentDialog } from '@/components/contents/RejectContentDialog'
import { allContentTypes, allPlatforms, contentTypeLabel, platformLabel, allReviewStatuses, reviewStatusLabel, reviewStatusClass } from '@/components/contents/constants'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import type { Content, ContentType, PaginatedResponse, Platform, ReviewStatus } from '@/types'

const ALL = '__all__'
const PAGE_SIZE = 20

type SortKey = 'newest' | 'oldest' | 'updated' | 'title'

const sortOptions: { value: SortKey; label: string; sort: string; order: 'ASC' | 'DESC' }[] = [
  { value: 'newest', label: '最新创建', sort: 'createdAt', order: 'DESC' },
  { value: 'oldest', label: '最早创建', sort: 'createdAt', order: 'ASC' },
  { value: 'updated', label: '最近修改', sort: 'updatedAt', order: 'DESC' },
  { value: 'title', label: '标题 A→Z', sort: 'title', order: 'ASC' },
]

export default function ContentsPage() {
  const qc = useQueryClient()
  const { me, isAdmin } = useMe()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState<ContentType | typeof ALL>(ALL)
  const [platform, setPlatform] = useState<Platform | typeof ALL>(ALL)
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | typeof ALL>(ALL)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [page, setPage] = useState(1)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Content | null>(null)
  const [publishing, setPublishing] = useState<Content[]>([])
  const [platformsOpen, setPlatformsOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Content[] | null>(null)
  const [rejecting, setRejecting] = useState<Content[]>([])

  // 每敲一个字就打一次接口没必要，停下来再查
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => setPage(1), [search, type, platform, reviewStatus, sortKey])

  const sortConfig = sortOptions.find((o) => o.value === sortKey)!
  const params = useMemo(() => ({
    ...(search ? { search } : {}),
    ...(type !== ALL ? { type } : {}),
    ...(platform !== ALL ? { platform } : {}),
    ...(reviewStatus !== ALL ? { reviewStatus } : {}),
    sort: sortConfig.sort,
    order: sortConfig.order,
    page,
    limit: PAGE_SIZE,
  }), [search, type, platform, reviewStatus, sortConfig, page])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['contents', params],
    queryFn: () => api.get<PaginatedResponse<Content>>('/contents', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  const contents = data?.data ?? []
  const totalPages = data?.totalPages ?? 1
  const hasFilters = Boolean(search) || type !== ALL || platform !== ALL || reviewStatus !== ALL

  // 翻页/筛选后留着上一页的选中项，会让「批量删除 N 项」删掉看不见的东西
  useEffect(() => setSelectedIds([]), [params])

  const selected = contents.filter((c) => selectedIds.includes(c.id))
  const allChecked = contents.length > 0 && selected.length === contents.length

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      ids.length === 1 ? api.delete(`/contents/${ids[0]}`) : api.post('/contents/bulk-delete', { ids }),
    onSuccess: () => {
      setConfirmDelete(null)
      setSelectedIds([])
      qc.invalidateQueries({ queryKey: ['contents'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const reviewMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: 'submit' | 'approve' }) => {
      if (action === 'submit') {
        return ids.length === 1
          ? api.post(`/contents/${ids[0]}/submit`)
          : api.post('/contents/bulk-submit', { ids })
      }
      return ids.length === 1
        ? api.post(`/contents/${ids[0]}/review`, { action: 'approve' })
        : api.post('/contents/bulk-review', { ids, action: 'approve' })
    },
    onSuccess: () => {
      setSelectedIds([])
      qc.invalidateQueries({ queryKey: ['contents'] })
    },
  })

  // 普通用户只能动自己建的作品，早年没有归属信息的作品只有管理员能动
  const canEdit = (c: Content) => isAdmin || (Boolean(c.createdById) && c.createdById === me?.id)

  const submittable = selected.filter((c) => canEdit(c) && (c.reviewStatus === 'draft' || c.reviewStatus === 'rejected'))
  const reviewable = isAdmin ? selected.filter((c) => c.reviewStatus === 'pending') : []
  const publishable = selected.filter((c) => c.reviewStatus === 'approved')
  const editable = selected.filter(canEdit)

  function toggleOne(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleAll() {
    setSelectedIds(allChecked ? [] : contents.map((c) => c.id))
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(item: Content) {
    setEditing(item)
    setFormOpen(true)
  }

  /** 表格行和窄屏卡片共用，两边的容器差别太大不好合并成一套 */
  function rowActions(item: Content) {
    return (
      <>
        {canEdit(item) && (item.reviewStatus === 'draft' || item.reviewStatus === 'rejected') && (
          <IconAction
            title="提交审核"
            disabled={reviewMutation.isPending}
            onClick={() => reviewMutation.mutate({ ids: [item.id], action: 'submit' })}
          >
            <FileCheck className="h-3.5 w-3.5" />
          </IconAction>
        )}
        {isAdmin && item.reviewStatus === 'pending' && (
          <>
            <IconAction
              title="审核通过"
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({ ids: [item.id], action: 'approve' })}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </IconAction>
            <IconAction title="驳回" onClick={() => setRejecting([item])}>
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            </IconAction>
          </>
        )}
        <IconAction
          title={item.reviewStatus === 'approved' ? '发布' : '审核通过后才能发布'}
          disabled={item.reviewStatus !== 'approved'}
          onClick={() => setPublishing([item])}
        >
          <Send className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction
          title={canEdit(item) ? '编辑' : '只能编辑自己创建的作品'}
          disabled={!canEdit(item)}
          onClick={() => openEdit(item)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction
          title={canEdit(item) ? '删除' : '只能删除自己创建的作品'}
          destructive
          disabled={!canEdit(item)}
          onClick={() => setConfirmDelete([item])}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconAction>
      </>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">作品管理</h1>
          <p className="text-muted-foreground text-sm mt-1">共 {data?.total ?? 0} 个作品</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">新建作品</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <div className="relative col-span-2 sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded-md border bg-background px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="搜索标题或文案…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <Select value={type} onValueChange={(v) => setType(v as ContentType | typeof ALL)}>
          <SelectTrigger className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部类型</SelectItem>
            {allContentTypes.map((t) => (
              <SelectItem key={t} value={t}>{contentTypeLabel[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={platform} onValueChange={(v) => setPlatform(v as Platform | typeof ALL)}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部平台</SelectItem>
            {allPlatforms.map((p) => (
              <SelectItem key={p} value={p}>{platformLabel[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as ReviewStatus | typeof ALL)}>
          <SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部审核状态</SelectItem>
            {allReviewStatuses.map((s) => (
              <SelectItem key={s} value={s}>{reviewStatusLabel[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sortOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            className="col-span-2"
            onClick={() => { setSearchInput(''); setType(ALL); setPlatform(ALL); setReviewStatus(ALL) }}
          >
            清除筛选
          </Button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">已选 {selected.length} 项</span>
          <div className="flex-1" />
          {submittable.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({ ids: submittable.map((c) => c.id), action: 'submit' })}
            >
              <FileCheck className="h-3.5 w-3.5" />
              提交审核 {submittable.length}
            </Button>
          )}
          {reviewable.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ ids: reviewable.map((c) => c.id), action: 'approve' })}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                通过 {reviewable.length}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejecting(reviewable)}>
                <XCircle className="h-3.5 w-3.5" />
                驳回 {reviewable.length}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={publishable.length === 0}
            title={publishable.length === 0 ? '选中的作品都还没通过审核' : undefined}
            onClick={() => setPublishing(publishable)}
          >
            <Send className="h-3.5 w-3.5" />
            批量发布{publishable.length < selected.length ? ` ${publishable.length}` : ''}
          </Button>
          <Button size="sm" variant="outline" disabled={editable.length === 0} onClick={() => setPlatformsOpen(true)}>
            <Tags className="h-3.5 w-3.5" />
            修改目标平台
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={editable.length === 0}
            onClick={() => setConfirmDelete(editable)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            批量删除{editable.length < selected.length ? ` ${editable.length}` : ''}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            <X className="h-3.5 w-3.5" />
            取消选择
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : contents.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 sm:p-16 text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {hasFilters ? '没有匹配的作品，试试放宽筛选条件。' : '还没有作品，先添加第一个视频或图片。'}
          </p>
          {!hasFilters && (
            <Button variant="outline" className="mt-4" onClick={openCreate}>新建作品</Button>
          )}
        </div>
      ) : (
        <>
        <div className="space-y-2 md:hidden">
          <label className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Checkbox checked={allChecked} indeterminate={selected.length > 0 && !allChecked} onChange={toggleAll} />
            全选本页
          </label>
          {contents.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-3 space-y-2.5 ${selectedIds.includes(item.id) ? 'bg-primary/5 border-primary/40' : 'bg-background'}`}
            >
              <div className="flex gap-3">
                <Checkbox checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id)} />
                <div className="h-10 w-16 shrink-0 rounded bg-muted overflow-hidden">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                      {contentTypeLabel[item.type]}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm break-words">{item.title}</p>
                  {item.caption && <p className="text-xs text-muted-foreground line-clamp-2">{item.caption}</p>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <ReviewState item={item} />
                <Badge variant="secondary" className="text-xs">{contentTypeLabel[item.type]}</Badge>
                {item.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
              </div>

              <div className="text-xs">
                <PublishState item={item} />
              </div>

              <div className="flex items-center justify-between gap-2 border-t pt-2">
                <span className="text-[11px] text-muted-foreground truncate">
                  {formatTime(item.createdAt)}{item.createdBy && ` · ${item.createdBy}`}
                </span>
                <div className="flex shrink-0 gap-1">{rowActions(item)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <Checkbox checked={allChecked} indeterminate={selected.length > 0 && !allChecked} onChange={toggleAll} />
                </th>
                <th className="px-3 py-2.5 text-left font-medium">作品</th>
                <th className="w-24 px-3 py-2.5 text-left font-medium">类型</th>
                <th className="px-3 py-2.5 text-left font-medium">目标平台</th>
                <th className="w-28 px-3 py-2.5 text-left font-medium">审核状态</th>
                <th className="w-44 px-3 py-2.5 text-left font-medium">发布状态</th>
                <th className="w-36 px-3 py-2.5 text-left font-medium">创建时间</th>
                <th className="w-40 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {contents.map((item) => (
                <tr
                  key={item.id}
                  className={`group hover:bg-muted/40 transition-colors ${selectedIds.includes(item.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-3 py-2 align-middle">
                    <Checkbox checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id)} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-14 shrink-0 rounded bg-muted overflow-hidden">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                            {contentTypeLabel[item.type]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[22rem]" title={item.title}>{item.title}</p>
                        {item.caption && (
                          <p className="text-xs text-muted-foreground truncate max-w-[22rem]">{item.caption}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-xs">{contentTypeLabel[item.type]}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {item.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <ReviewState item={item} />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <PublishState item={item} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <p className="tabular-nums">{formatTime(item.createdAt)}</p>
                    {item.createdBy && <p className="truncate">by {item.createdBy}</p>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {rowActions(item)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
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

      {confirmDelete && (
        <ConfirmDelete
          items={confirmDelete}
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMutation.mutate(confirmDelete.map((c) => c.id))}
        />
      )}

      <ContentFormDialog open={formOpen} content={editing} onClose={() => setFormOpen(false)} />
      <PublishContentDialog
        contents={publishing}
        onClose={() => setPublishing([])}
        onPublished={() => { setPublishing([]); setSelectedIds([]) }}
      />
      <BulkPlatformsDialog
        open={platformsOpen}
        ids={editable.map((c) => c.id)}
        onClose={() => setPlatformsOpen(false)}
        onDone={() => { setPlatformsOpen(false); setSelectedIds([]) }}
      />
      <RejectContentDialog
        contents={rejecting}
        onClose={() => setRejecting([])}
        onDone={() => { setRejecting([]); setSelectedIds([]) }}
      />
    </div>
  )
}

function Checkbox({ checked, indeterminate, onChange }: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  // indeterminate 只能用 JS 设，没有对应的 HTML 属性
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded align-middle cursor-pointer"
    />
  )
}

function ConfirmDelete({ items, pending, onCancel, onConfirm }: {
  items: Content[]
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl border bg-background p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm">
          {items.length === 1
            ? `删除「${items[0].title}」后关联的发布任务也会一并消失，确定删除？`
            : `将删除 ${items.length} 个作品，关联的发布任务也会一并消失，确定删除？`}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>取消</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={pending}>
            {pending ? '删除中…' : '确定删除'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function IconAction({ title, destructive, disabled, onClick, children }: {
  title: string
  destructive?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        destructive ? 'hover:bg-destructive hover:text-white' : 'enabled:hover:bg-accent'
      }`}
    >
      {children}
    </button>
  )
}

function ReviewState({ item }: { item: Content }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex w-fit rounded px-1.5 py-0.5 text-xs font-medium ${reviewStatusClass[item.reviewStatus]}`}>
        {reviewStatusLabel[item.reviewStatus]}
      </span>
      {item.reviewStatus === 'rejected' && item.reviewNote && (
        <span className="text-[11px] text-muted-foreground truncate max-w-[10rem]" title={item.reviewNote}>
          {item.reviewNote}
        </span>
      )}
    </div>
  )
}

function PublishState({ item }: { item: Content }) {
  if (item.taskCount === 0) return <span className="text-muted-foreground">未发布</span>
  if (item.lastPublishedAt) {
    return (
      <span className="text-emerald-600">
        已发布 · {formatTime(item.lastPublishedAt)}
        {item.failedCount > 0 && <span className="text-destructive"> · {item.failedCount} 次失败</span>}
      </span>
    )
  }
  if (item.failedCount > 0) return <span className="text-destructive">{item.failedCount} 次发布失败</span>
  return <span className="text-muted-foreground">{item.taskCount} 个任务待发布</span>
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
