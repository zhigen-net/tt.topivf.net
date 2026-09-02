import { useState } from 'react'
import { Plus, Search, RefreshCw, Trash2, Pencil } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlatformBadge } from '@/components/PlatformBadge'
import { AddAccountDialog } from '@/components/accounts/AddAccountDialog'
import { AccountDetailDrawer } from '@/components/accounts/AccountDetailDrawer'
import { AccountEditDialog } from '@/components/accounts/AccountEditDialog'
import { api } from '@/lib/api'
import type { Account, AccountStatus } from '@/types'

const statusVariant: Record<AccountStatus, 'success' | 'destructive' | 'secondary' | 'warning'> = {
  active: 'success',
  inactive: 'secondary',
  banned: 'destructive',
  warming: 'warning',
}

const statusLabel: Record<AccountStatus, string> = {
  active: '正常',
  inactive: '停用',
  banned: '封禁',
  warming: '养号',
}

export default function AccountsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: Account[]; total: number }>('/accounts').then((r) => r.data),
  })

  // 抽屉里存 id 而不是对象，编辑保存后才能拿到刷新过的数据
  const selectedAccount = data?.data.find((a) => a.id === selectedId) ?? null
  const editingAccount = data?.data.find((a) => a.id === editingId) ?? null

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })

  const statusToggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
      api.patch(`/accounts/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const accounts = (data?.data ?? []).filter(
    (a) => a.username.includes(search) || a.displayName.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">账号管理</h1>
          <p className="text-muted-foreground text-sm mt-1">共 {data?.total ?? 0} 个账号</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            添加账号
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded-md border bg-background px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="搜索账号…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">账号</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">平台</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">粉丝</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">作品</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">代理</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">加载中…</td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {search ? '没有匹配的账号' : '还没有账号，点击右上角添加'}
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  {/* 点击账号信息区域打开详情 */}
                  <td
                    className="px-4 py-3 cursor-pointer"
                    onClick={() => setSelectedId(account.id)}
                  >
                    <div className="flex items-center gap-2">
                      {account.avatar ? (
                        <img src={account.avatar} alt={account.displayName} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {account.displayName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium hover:underline underline-offset-2">{account.displayName}</div>
                        <div className="text-xs text-muted-foreground">@{account.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><PlatformBadge platform={account.platform} /></td>
                  <td className="px-4 py-3">
                    <button
                      title="点击切换启用/停用"
                      disabled={statusToggleMutation.isPending}
                      onClick={() => statusToggleMutation.mutate({
                        id: account.id,
                        status: account.status === 'active' ? 'inactive' : 'active',
                      })}
                      className="cursor-pointer disabled:opacity-50"
                    >
                      <Badge variant={statusVariant[account.status]}>{statusLabel[account.status]}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtNum(account.followers)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{account.postsCount}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{account.proxyId ? account.proxyId.slice(0, 8) + '…' : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="编辑"
                        onClick={() => setEditingId(account.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="删除"
                        onClick={() => deleteMutation.mutate(account.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddAccountDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <AccountDetailDrawer
        account={selectedAccount}
        onClose={() => setSelectedAccount(null)}
        onEdit={(a) => setEditingId(a.id)}
      />
      <AccountEditDialog account={editingAccount} onClose={() => setEditingAccount(null)} />
    </div>
  )
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
