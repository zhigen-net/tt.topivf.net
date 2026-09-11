import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { allPlatforms, platformLabel } from '@/components/contents/constants'
import { useAllAccounts } from '@/lib/accounts'
import { api } from '@/lib/api'
import type { AssetType, Platform } from '@/types'

export interface AssetFilterState {
  search: string
  type?: AssetType
  referenced?: 'true' | 'false'
  published?: 'true' | 'false'
  accountIds: string[]
  platform?: Platform
  uploadedById?: string
  from?: string
  to?: string
  sort: 'createdAt' | 'size' | 'filename'
  order: 'ASC' | 'DESC'
  page: number
  open: boolean
}

interface Uploader {
  id: string
  name: string
  count: number
}

/** 地址栏就是这一页的唯一状态源：刷新、收藏、把链接发给同事都能还原出同一屏 */
export function useAssetFilters() {
  const [params, setParams] = useSearchParams()

  const state = useMemo<AssetFilterState>(() => ({
    search: params.get('q') ?? '',
    type: asOneOf(params.get('type'), ['video', 'image'] as const),
    referenced: asOneOf(params.get('ref'), ['true', 'false'] as const),
    published: asOneOf(params.get('pub'), ['true', 'false'] as const),
    accountIds: (params.get('acc') ?? '').split(',').filter(Boolean),
    platform: asOneOf(params.get('plat'), allPlatforms),
    uploadedById: params.get('by') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    sort: asOneOf(params.get('sort'), ['createdAt', 'size', 'filename'] as const) ?? 'createdAt',
    order: asOneOf(params.get('order'), ['ASC', 'DESC'] as const) ?? 'DESC',
    page: Math.max(1, Number(params.get('page')) || 1),
    open: params.get('panel') === '1',
  }), [params])

  const patch = useCallback((next: Partial<AssetFilterState>) => {
    setParams((prev) => {
      const sp = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(KEYS) as [keyof AssetFilterState, string][]) {
        if (!(key in next)) continue
        const raw = next[key]
        const str = Array.isArray(raw) ? raw.join(',') : raw === true ? '1' : raw === false ? '' : String(raw ?? '')
        if (str) sp.set(value, str)
        else sp.delete(value)
      }
      // 改了任何条件都得回到第一页，否则很容易停在一个空白页上。
      // 翻页本身和展开面板不算改条件
      if (Object.keys(next).some((k) => k !== 'page' && k !== 'open')) sp.delete('page')
      return sp
    }, { replace: true })
  }, [setParams])

  const reset = useCallback(() => {
    setParams((prev) => {
      const sp = new URLSearchParams(prev)
      for (const key of Object.values(KEYS)) if (key !== 'panel') sp.delete(key)
      return sp
    }, { replace: true })
  }, [setParams])

  return { filters: state, patch, reset }
}

const KEYS: Record<keyof AssetFilterState, string> = {
  search: 'q',
  type: 'type',
  referenced: 'ref',
  published: 'pub',
  accountIds: 'acc',
  platform: 'plat',
  uploadedById: 'by',
  from: 'from',
  to: 'to',
  sort: 'sort',
  order: 'order',
  page: 'page',
  open: 'panel',
}

/** 发给 /assets 的查询参数。空值一律省掉，免得 queryKey 里混进一堆 undefined 的噪声 */
export function toQueryParams(f: AssetFilterState, limit: number) {
  return {
    ...(f.search ? { search: f.search } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.referenced ? { referenced: f.referenced } : {}),
    ...(f.published ? { published: f.published } : {}),
    ...(f.accountIds.length ? { accountIds: f.accountIds.join(',') } : {}),
    ...(f.platform ? { platform: f.platform } : {}),
    ...(f.uploadedById ? { uploadedById: f.uploadedById } : {}),
    ...(f.from ? { from: f.from } : {}),
    ...(f.to ? { to: f.to } : {}),
    sort: f.sort,
    order: f.order,
    page: f.page,
    limit,
  }
}

export function activeFilterCount(f: AssetFilterState) {
  return [f.type, f.referenced, f.published, f.platform, f.uploadedById, f.from, f.to]
    .filter(Boolean).length + (f.accountIds.length ? 1 : 0) + (f.search ? 1 : 0)
}

export function AssetFilters({ filters, patch, reset, searchInput, onSearchInput }: {
  filters: AssetFilterState
  patch: (next: Partial<AssetFilterState>) => void
  reset: () => void
  searchInput: string
  onSearchInput: (v: string) => void
}) {
  const accounts = useAllAccounts()
  const { data: uploaders = [] } = useQuery({
    queryKey: ['assets', 'uploaders'],
    queryFn: () => api.get<Uploader[]>('/assets/uploaders').then((r) => r.data),
  })

  const count = activeFilterCount(filters)
  const neverPublished = filters.published === 'false'
  const visibleAccounts = filters.platform
    ? accounts.filter((a) => a.platform === filters.platform)
    : accounts

  function toggleAccount(id: string) {
    const next = filters.accountIds.includes(id)
      ? filters.accountIds.filter((x) => x !== id)
      : [...filters.accountIds, id]
    patch({ accountIds: next })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchInput}
          onChange={(e) => onSearchInput(e.target.value)}
          placeholder="搜索文件名，空格分词"
          className="max-w-64"
        />
        <Select
          value={filters.type ?? 'all'}
          onValueChange={(v) => patch({ type: v === 'all' ? undefined : (v as AssetType) })}
        >
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="video">视频</SelectItem>
            <SelectItem value="image">图片</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={`${filters.sort}:${filters.order}`}
          onValueChange={(v) => {
            const [sort, order] = v.split(':') as [AssetFilterState['sort'], AssetFilterState['order']]
            patch({ sort, order })
          }}
        >
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt:DESC">最新上传</SelectItem>
            <SelectItem value="createdAt:ASC">最早上传</SelectItem>
            <SelectItem value="size:DESC">文件从大到小</SelectItem>
            <SelectItem value="size:ASC">文件从小到大</SelectItem>
            <SelectItem value="filename:ASC">文件名 A→Z</SelectItem>
            <SelectItem value="filename:DESC">文件名 Z→A</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={filters.open ? 'secondary' : 'outline'} onClick={() => patch({ open: !filters.open })}>
          <SlidersHorizontal className="h-4 w-4" />
          筛选{count ? ` · ${count}` : ''}
          <ChevronDown className={`h-4 w-4 transition-transform ${filters.open ? 'rotate-180' : ''}`} />
        </Button>
        {count > 0 && (
          <Button variant="ghost" onClick={reset}>清空</Button>
        )}
      </div>

      {filters.open && (
        <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="引用情况">
            <TriState
              value={filters.referenced}
              onChange={(v) => patch({ referenced: v })}
              labels={['全部', '已被作品引用', '没有被引用']}
            />
          </Field>

          <Field label="发布情况">
            <TriState
              value={filters.published}
              onChange={(v) => patch({
                published: v,
                // 「从没发布过」和「发布到过某账号」同时成立是空集，切过去就把账号条件收掉
                ...(v === 'false' ? { accountIds: [], platform: undefined } : {}),
              })}
              labels={['全部', '发布过', '从没发布过']}
            />
          </Field>

          <Field label="上传者">
            <Select
              value={filters.uploadedById ?? 'all'}
              onValueChange={(v) => patch({ uploadedById: v === 'all' ? undefined : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {uploaders.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}（{u.count}）</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="上传时间">
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={filters.from ?? ''}
                max={filters.to}
                onChange={(e) => patch({ from: e.target.value || undefined })}
                className="text-xs"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={filters.to ?? ''}
                min={filters.from}
                onChange={(e) => patch({ to: e.target.value || undefined })}
                className="text-xs"
              />
            </div>
          </Field>

          <Field label="发布到过的平台">
            <Select
              disabled={neverPublished}
              value={filters.platform ?? 'all'}
              onValueChange={(v) => patch({
                platform: v === 'all' ? undefined : (v as Platform),
                // 切了平台再留着别的平台的账号勾选，筛出来会恒为空
                accountIds: [],
              })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部平台</SelectItem>
                {allPlatforms.map((p) => (
                  <SelectItem key={p} value={p}>{platformLabel[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="sm:col-span-2 lg:col-span-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">发布到过的账号</p>
            <div className={`max-h-36 overflow-y-auto rounded-lg border bg-background p-2 ${
              neverPublished ? 'pointer-events-none opacity-50' : ''
            }`}
            >
              {neverPublished ? (
                <p className="p-1 text-xs text-muted-foreground">已选「从没发布过」，按账号筛不适用</p>
              ) : visibleAccounts.length === 0 ? (
                <p className="p-1 text-xs text-muted-foreground">没有可选的账号</p>
              ) : visibleAccounts.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-accent">
                  <Checkbox
                    checked={filters.accountIds.includes(a.id)}
                    onChange={() => toggleAccount(a.id)}
                  />
                  <span className="truncate text-xs">{a.displayName || a.username}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {platformLabel[a.platform]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
            「发布过」按素材在作品里的实际去向算，作为封面出现也算。
          </p>
        </div>
      )}

      {count > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.search && <Chip onClear={() => onSearchInput('')}>文件名：{filters.search}</Chip>}
          {filters.type && (
            <Chip onClear={() => patch({ type: undefined })}>
              {filters.type === 'video' ? '视频' : '图片'}
            </Chip>
          )}
          {filters.referenced && (
            <Chip onClear={() => patch({ referenced: undefined })}>
              {filters.referenced === 'true' ? '已被引用' : '未被引用'}
            </Chip>
          )}
          {filters.published && (
            <Chip onClear={() => patch({ published: undefined })}>
              {filters.published === 'true' ? '发布过' : '从没发布过'}
            </Chip>
          )}
          {filters.platform && (
            <Chip onClear={() => patch({ platform: undefined })}>
              发布到 {platformLabel[filters.platform]}
            </Chip>
          )}
          {filters.accountIds.map((id) => (
            <Chip key={id} onClear={() => toggleAccount(id)}>
              发布到 {accounts.find((a) => a.id === id)?.displayName ?? '账号'}
            </Chip>
          ))}
          {filters.uploadedById && (
            <Chip onClear={() => patch({ uploadedById: undefined })}>
              上传者：{uploaders.find((u) => u.id === filters.uploadedById)?.name ?? '未知'}
            </Chip>
          )}
          {filters.from && <Chip onClear={() => patch({ from: undefined })}>{filters.from} 起</Chip>}
          {filters.to && <Chip onClear={() => patch({ to: undefined })}>至 {filters.to}</Chip>}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

/** 全部 / 是 / 否 三态，比两个独立的勾选框更难选出自相矛盾的组合 */
function TriState({ value, onChange, labels }: {
  value?: 'true' | 'false'
  onChange: (v?: 'true' | 'false') => void
  labels: [string, string, string]
}) {
  const options: [string | undefined, string][] = [
    [undefined, labels[0]],
    ['true', labels[1]],
    ['false', labels[2]],
  ]
  return (
    <div className="flex rounded-lg border bg-background p-0.5">
      {options.map(([v, label]) => (
        <button
          key={label}
          onClick={() => onChange(v as 'true' | 'false' | undefined)}
          className={`flex-1 rounded-md px-1.5 py-1 text-xs transition-colors ${
            value === v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Chip({ children, onClear }: { children: React.ReactNode, onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
      {children}
      <button onClick={onClear} className="text-muted-foreground hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function asOneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined
}
