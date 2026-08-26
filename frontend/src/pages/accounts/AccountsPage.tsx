import { useState } from 'react'
import { Plus, Search, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlatformBadge } from '@/components/PlatformBadge'
import { api } from '@/lib/api'
import type { Account, AccountStatus } from '@/types'

const statusVariant: Record<AccountStatus, 'success' | 'destructive' | 'secondary' | 'warning'> = {
  active: 'success',
  inactive: 'secondary',
  banned: 'destructive',
  warming: 'warning',
}

export default function AccountsPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: Account[]; total: number }>('/accounts').then((r) => r.data),
  })

  const accounts = (data?.data ?? []).filter(
    (a) => a.username.includes(search) || a.displayName.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} accounts total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button>
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded-md border bg-background px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Search accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Platform</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Followers</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Posts</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Proxy</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No accounts found.
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {account.displayName[0]}
                      </div>
                      <div>
                        <div className="font-medium">{account.displayName}</div>
                        <div className="text-xs text-muted-foreground">@{account.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PlatformBadge platform={account.platform} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[account.status]}>{account.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">{account.followers.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{account.postsCount}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{account.proxyId ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
