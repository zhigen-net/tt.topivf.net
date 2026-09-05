import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, CheckCircle2, Clock } from 'lucide-react'
import { allPlatforms, platformLabel } from '@/components/contents/constants'
import { accountStatusLabel as statusLabel } from '@/components/accounts/constants'
import { api } from '@/lib/api'
import type { Account, PaginatedResponse, Platform, PublishTask } from '@/types'

/** 账号在当前作品上的发布痕迹 */
export interface AccountPublishState {
  /** 上次成功发布的时间 */
  publishedAt?: string
  /** 还有未完成的任务排队中 */
  pending?: boolean
}

/** 查这个作品发过哪些账号，用来在选择器里标记出来 */
export function usePublishHistory(contentId: string | undefined, enabled = true) {
  const { data } = useQuery({
    queryKey: ['tasks', 'by-content', contentId],
    queryFn: () => api.get<PaginatedResponse<PublishTask>>('/tasks', {
      params: { contentId, limit: 100 },
    }).then((r) => r.data),
    enabled: enabled && Boolean(contentId),
  })

  return useMemo(() => {
    if (!data) return undefined
    const map: Record<string, AccountPublishState> = {}
    for (const t of data.data) {
      for (const r of t.results ?? []) {
        if (!r.success) continue
        const at = t.completedAt ?? t.scheduledAt
        const prev = map[r.accountId]?.publishedAt
        if (!prev || prev < at) map[r.accountId] = { ...map[r.accountId], publishedAt: at }
      }
      if (t.status === 'pending' || t.status === 'running') {
        // 任务还没跑完，results 里没有的账号就是还排着队的
        const settled = new Set((t.results ?? []).map((r) => r.accountId))
        for (const id of t.accountIds) {
          if (!settled.has(id)) map[id] = { ...map[id], pending: true }
        }
      }
    }
    return map
  }, [data])
}

interface Props {
  accounts: Account[]
  selected: string[]
  onChange: (ids: string[]) => void
  /** accountId -> 发布痕迹，传了就会标记出来并默认不允许重复选中 */
  history?: Record<string, AccountPublishState>
  emptyHint?: string
}

// 账号多到一定程度时全量渲染会卡，超出的部分让用户用搜索找
const RENDER_CAP = 150

export function AccountPicker({ accounts, selected, onChange, history, emptyHint }: Props) {
  const [search, setSearch] = useState('')
  const [allowRepeat, setAllowRepeat] = useState(false)
  const [collapsed, setCollapsed] = useState<Platform[]>([])

  const marked = useMemo(
    () => accounts.filter((a) => history?.[a.id]),
    [accounts, history],
  )
  const lockedIds = allowRepeat ? new Set<string>() : new Set(marked.map((a) => a.id))

  const matched = useMemo(() => {
    const kw = search.trim().toLowerCase()
    if (!kw) return accounts
    return accounts.filter(
      (a) => a.displayName.toLowerCase().includes(kw) || a.username.toLowerCase().includes(kw),
    )
  }, [accounts, search])

  const groups = useMemo(() => {
    return allPlatforms
      .map((p) => ({ platform: p, items: matched.filter((a) => a.platform === p) }))
      .filter((g) => g.items.length > 0)
  }, [matched])

  const selectable = matched.filter((a) => !lockedIds.has(a.id))
  const selectedSet = new Set(selected)

  function setIds(ids: Set<string>) {
    onChange([...ids])
  }

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setIds(next)
  }

  function toggleGroup(items: Account[]) {
    const usable = items.filter((a) => !lockedIds.has(a.id))
    const allOn = usable.length > 0 && usable.every((a) => selectedSet.has(a.id))
    const next = new Set(selected)
    for (const a of usable) {
      if (allOn) next.delete(a.id)
      else next.add(a.id)
    }
    setIds(next)
  }

  function toggleAll() {
    const allOn = selectable.length > 0 && selectable.every((a) => selectedSet.has(a.id))
    const next = new Set(selected)
    for (const a of selectable) {
      if (allOn) next.delete(a.id)
      else next.add(a.id)
    }
    setIds(next)
  }

  // 关掉重复发布时，已经勾上的历史账号得跟着取消，否则会带着提交
  function setAllowRepeatSafely(next: boolean) {
    setAllowRepeat(next)
    if (!next && history) {
      onChange(selected.filter((id) => !history[id]))
    }
  }

  function toggleCollapse(p: Platform) {
    setCollapsed((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyHint ?? '没有可用的账号。'}
      </p>
    )
  }

  const allOn = selectable.length > 0 && selectable.every((a) => selectedSet.has(a.id))
  let rendered = 0
  let hiddenByCap = 0

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`搜索 ${accounts.length} 个账号…`}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={toggleAll}
          disabled={selectable.length === 0}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          {allOn ? '清空' : '全选'}
        </button>
      </div>

      {marked.length > 0 && (
        <label className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={allowRepeat}
            onChange={(e) => setAllowRepeatSafely(e.target.checked)}
            className="h-3.5 w-3.5 rounded"
          />
          <span className="text-muted-foreground">
            允许重发到已发布过的账号（{marked.length} 个）
          </span>
        </label>
      )}

      <div className="max-h-64 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">没有匹配的账号</p>
        ) : (
          groups.map(({ platform, items }) => {
            const isCollapsed = collapsed.includes(platform)
            const usable = items.filter((a) => !lockedIds.has(a.id))
            const picked = items.filter((a) => selectedSet.has(a.id)).length
            const visible = isCollapsed ? [] : items.slice(0, Math.max(0, RENDER_CAP - rendered))
            rendered += visible.length
            if (!isCollapsed) hiddenByCap += items.length - visible.length

            return (
              <div key={platform}>
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted/80 px-3 py-1 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(platform)}
                    className="text-xs font-medium hover:underline"
                  >
                    {platformLabel[platform]}
                    <span className="ml-1 text-muted-foreground font-normal">
                      {picked > 0 ? `${picked}/${items.length}` : items.length}
                    </span>
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => toggleGroup(items)}
                    disabled={usable.length === 0}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    {usable.length > 0 && usable.every((a) => selectedSet.has(a.id)) ? '取消本组' : '选中本组'}
                  </button>
                </div>

                {visible.map((a) => {
                  const state = history?.[a.id]
                  const locked = lockedIds.has(a.id)
                  return (
                    <label
                      key={a.id}
                      className={`flex items-center gap-2.5 border-b px-3 py-2 last:border-0 ${
                        locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(a.id)}
                        disabled={locked}
                        onChange={() => toggle(a.id)}
                        className="h-4 w-4 rounded shrink-0"
                      />
                      {a.avatar ? (
                        <img src={a.avatar} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                          {a.displayName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{a.displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">@{a.username}</div>
                      </div>
                      {a.status !== 'active' && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700">
                          {statusLabel[a.status]}
                        </span>
                      )}
                      {state?.pending ? (
                        <span className="shrink-0 flex items-center gap-1 text-[10px] text-blue-600" title="已有任务排队中">
                          <Clock className="h-3 w-3" />
                          待发布
                        </span>
                      ) : state?.publishedAt ? (
                        <span
                          className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-600"
                          title={`已于 ${new Date(state.publishedAt).toLocaleString('zh-CN')} 发布`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          已发布
                        </span>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            )
          })
        )}

        {hiddenByCap > 0 && (
          <p className="px-3 py-2 text-center text-xs text-muted-foreground">
            还有 {hiddenByCap} 个账号未显示，用搜索缩小范围
          </p>
        )}
      </div>
    </div>
  )
}
