import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, RefreshCw, Trash2, Pencil, ExternalLink, ChevronLeft, ChevronRight, Power, PowerOff, Plug, X, FileText } from 'lucide-react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { PlatformBadge } from '@/components/PlatformBadge'
import { AddAccountDialog } from '@/components/accounts/AddAccountDialog'
import { AccountDetailDrawer } from '@/components/accounts/AccountDetailDrawer'
import {
  accountProfileUrl,
  accountStatusLabel as statusLabel, accountStatusVariant as statusVariant,
} from '@/components/accounts/constants'
import { api } from '@/lib/api'
import { useWorkspace } from '@/lib/workspace'
import type { Account, AccountStatus, PaginatedResponse } from '@/types'

const PAGE_SIZE = 10

export default function AccountsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { can } = useWorkspace()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view')
  const [removing, setRemoving] = useState<Account[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [syncing, setSyncing] = useState<{ done: number; total: number } | null>(null)
  const [syncResult, setSyncResult] = useState<{ ok: number; failed: number } | null>(null)

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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accounts', params],
    queryFn: () => api.get<PaginatedResponse<Account>>('/accounts', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  // 整个空间一次算完，不跟着分页走：翻页时数字不会闪
  const { data: pendingComments } = useQuery({
    queryKey: ['comments-pending-by-account'],
    queryFn: () => api.get<Record<string, number>>('/comments/pending-by-account').then((r) => r.data),
  })

  // 抽屉里存 id 而不是对象，编辑保存后才能拿到刷新过的数据
  const selectedAccount = data?.data.find((a) => a.id === selectedId) ?? null

  function openDrawer(id: string, mode: 'view' | 'edit') {
    setDrawerMode(mode)
    setSelectedId(id)
  }

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      ids.length === 1 ? api.delete(`/accounts/${ids[0]}`) : api.post('/accounts/bulk-delete', { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setRemoving(null)
      setSelectedIds([])
    },
  })

  const statusMutation = useMutation({
    // 不 return 响应：两个分支请求体不同，axios 会把它带进返回类型导致类型对不上
    mutationFn: async ({ ids, status }: { ids: string[]; status: AccountStatus }) => {
      if (ids.length === 1) await api.patch(`/accounts/${ids[0]}/status`, { status })
      else await api.post('/accounts/bulk-status', { ids, status })
    },
    // 不清选中：批量停用完常常紧接着就要删，留着省一次重选
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const syncMutation = useMutation({
    // 逐个串行：同步是打平台接口，并发发出去会撞限流，串行还顺带给得出进度
    mutationFn: async (ids: string[]) => {
      let failed = 0
      for (const [i, id] of ids.entries()) {
        try {
          await api.post(`/accounts/${id}/sync`)
        } catch {
          failed++
        }
        setSyncing({ done: i + 1, total: ids.length })
      }
      return { ok: ids.length - failed, failed }
    },
    onMutate: (ids: string[]) => {
      setSyncResult(null)
      setSyncing({ done: 0, total: ids.length })
    },
    onSuccess: setSyncResult,
    onSettled: () => {
      setSyncing(null)
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })

  const accounts = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  // 只认当前页可见的选中项：翻页后残留的 id 不参与任何批量操作
  const selected = accounts.filter((a) => selectedIds.includes(a.id))
  const allChecked = accounts.length > 0 && selected.length === accounts.length
  const activatable = selected.filter((a) => a.status !== 'active')
  const deactivatable = selected.filter((a) => a.status !== 'inactive')
  // 删除沿用单个删除那道闸：只有已停用的才删得掉
  const removable = selected.filter((a) => a.status === 'inactive')

  function toggleOne(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleAll() {
    setSelectedIds(allChecked ? [] : accounts.map((a) => a.id))
  }

  function statusToggle(account: Account) {
    const disabled = account.status === 'inactive'
    return (
      <button
        title={disabled ? '点击启用' : '点击停用（停用后才出现删除按钮）'}
        disabled={statusMutation.isPending}
        // 养号/封禁也一键就能停用，否则要先点成正常再点一次才停得掉
        onClick={() => statusMutation.mutate({
          ids: [account.id],
          status: disabled ? 'active' : 'inactive',
        })}
        className="cursor-pointer disabled:opacity-50"
      >
        <Badge variant={statusVariant[account.status]}>{statusLabel[account.status]}</Badge>
      </button>
    )
  }

  /** 表格行和窄屏卡片共用 */
  function rowActions(account: Account) {
    const profileUrl = accountProfileUrl(account)
    return (
      <>
        {profileUrl && (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={`在平台上打开 ${account.displayName}`}
          >
            <a href={profileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="编辑"
          onClick={() => openDrawer(account.id, 'edit')}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {/* 删除入口要先停用才出现，避免在列表里手滑点掉还在跑的账号 */}
        {account.status === 'inactive' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="删除"
            onClick={() => { deleteMutation.reset(); setRemoving([account]) }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </>
    )
  }

  /** 待回复评论数。0 条时不给链接，点进去只会看到空列表 */
  function commentsCell(account: Account) {
    const count = pendingComments?.[account.id] ?? 0
    if (!count) return <span className="text-muted-foreground">—</span>
    return (
      <Link
        to={`/comments?accountId=${account.id}`}
        className="font-medium text-primary hover:underline underline-offset-2"
        title={`查看 ${account.displayName} 的待回复评论`}
      >
        {count}
      </Link>
    )
  }

  function avatar(account: Account, size: string) {
    return account.avatar ? (
      <img src={account.avatar} alt={account.displayName} className={`${size} shrink-0 rounded-full object-cover`} />
    ) : (
      <div className={`${size} shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-medium`}>
        {account.displayName[0]?.toUpperCase()}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">账号管理</h1>
          <p className="text-muted-foreground text-sm mt-1">共 {data?.total ?? 0} 个账号</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">添加账号</span>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded-md border bg-background px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="搜索账号名或昵称…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">已选 {selected.length} 个账号</span>
          {syncing && (
            <span className="text-sm text-muted-foreground tabular-nums">
              同步中 {syncing.done}/{syncing.total}…
            </span>
          )}
          {!syncing && syncResult && (
            <span className="text-sm text-muted-foreground">
              同步完成：成功 {syncResult.ok}
              {syncResult.failed > 0 && `，失败 ${syncResult.failed}`}
            </span>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            disabled={activatable.length === 0 || statusMutation.isPending}
            onClick={() => statusMutation.mutate({ ids: activatable.map((a) => a.id), status: 'active' })}
          >
            <Power className="h-3.5 w-3.5" />
            启用{activatable.length < selected.length ? ` ${activatable.length}` : ''}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={deactivatable.length === 0 || statusMutation.isPending}
            onClick={() => statusMutation.mutate({ ids: deactivatable.map((a) => a.id), status: 'inactive' })}
          >
            <PowerOff className="h-3.5 w-3.5" />
            停用{deactivatable.length < selected.length ? ` ${deactivatable.length}` : ''}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate(selected.map((a) => a.id))}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            同步 {selected.length}
          </Button>
          {/* 密钥只能由 member 及以上签发，viewer 看得见按钮点了只会吃 403 */}
          {can('member') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/mcp?accounts=${selected.map((a) => a.id).join(',')}`)}
            >
              <Plug className="h-3.5 w-3.5" />
              生成 MCP 密钥 {selected.length}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={removable.length === 0}
            title={removable.length === 0 ? '选中的账号都还没停用，停用后才能删除' : undefined}
            onClick={() => { deleteMutation.reset(); setRemoving(removable) }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除{removable.length < selected.length ? ` ${removable.length}` : ''}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            <X className="h-3.5 w-3.5" />
            取消选择
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
      ) : accounts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search ? '没有匹配的账号' : '还没有账号，点击右上角添加'}
        </p>
      ) : (
        <div className="space-y-2 md:hidden">
          <label className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
            <Checkbox checked={allChecked} indeterminate={selected.length > 0 && !allChecked} onChange={toggleAll} />
            全选本页
          </label>
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`rounded-xl border p-3 space-y-2.5 ${selectedIds.includes(account.id) ? 'bg-primary/5 border-primary/40' : 'bg-background'}`}
            >
              <div className="flex items-center gap-2">
                <Checkbox checked={selectedIds.includes(account.id)} onChange={() => toggleOne(account.id)} />
                <div className="flex min-w-0 flex-1 items-center gap-2" onClick={() => openDrawer(account.id, 'view')}>
                  {avatar(account, 'h-9 w-9')}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm">{account.displayName}</div>
                    <div className="truncate text-xs text-muted-foreground">@{account.username}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <PlatformBadge platform={account.platform} />
                {statusToggle(account)}
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  粉丝 {fmtNum(account.followers)} · 作品 {account.postsCount}
                  {!!pendingComments?.[account.id] && (
                    <> · 待回复 <Link to={`/comments?accountId=${account.id}`} className="font-medium text-primary">
                      {pendingComments[account.id]}
                    </Link></>
                  )}
                  {account.proxyId && ` · 代理 ${account.proxyId.slice(0, 8)}…`}
                </span>
                <div className="flex shrink-0 gap-1">{rowActions(account)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="hidden md:block rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="w-12 px-4 py-3 text-left">
                <Checkbox checked={allChecked} indeterminate={selected.length > 0 && !allChecked} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">账号</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">平台</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">粉丝</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">作品</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">待回复评论</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">代理</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">加载中…</td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  {search ? '没有匹配的账号' : '还没有账号，点击右上角添加'}
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr
                  key={account.id}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${selectedIds.includes(account.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="w-12 px-4 py-3">
                    <Checkbox checked={selectedIds.includes(account.id)} onChange={() => toggleOne(account.id)} />
                  </td>
                  {/* 点击账号信息区域打开详情 */}
                  <td
                    className="px-4 py-3 cursor-pointer"
                    onClick={() => openDrawer(account.id, 'view')}
                  >
                    <div className="flex items-center gap-2">
                      {avatar(account, 'h-8 w-8')}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium hover:underline underline-offset-2">{account.displayName}</span>
                          {account.brief && (
                            <span title="已设更新要求" className="flex">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">@{account.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><PlatformBadge platform={account.platform} /></td>
                  <td className="px-4 py-3">{statusToggle(account)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtNum(account.followers)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{account.postsCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{commentsCell(account)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{account.proxyId ? account.proxyId.slice(0, 8) + '…' : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">{rowActions(account)}</div>
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

      <AddAccountDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <AccountDetailDrawer
        account={selectedAccount}
        initialMode={drawerMode}
        onClose={() => setSelectedId(null)}
      />
      <ConfirmDeleteDialog
        open={!!removing?.length}
        title={removing && removing.length > 1 ? `删除 ${removing.length} 个账号` : '删除账号'}
        description={
          <>
            删除
            {removing && removing.length > 1
              ? `这 ${removing.length} 个账号`
              : `「${removing?.[0]?.displayName}」`}
            后，
            {removing && removing.length > 1 ? '它们的' : '它的'}粉丝历史和发布记录一并消失，且不可恢复。
            账号在平台上的内容不受影响。确定删除？
          </>
        }
        pending={deleteMutation.isPending}
        error={deleteMutation.error}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && deleteMutation.mutate(removing.map((a) => a.id))}
      />
    </div>
  )
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
