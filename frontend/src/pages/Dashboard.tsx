import { Users, FileVideo, CalendarClock, TrendingUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlatformBadge } from '@/components/PlatformBadge'
import { taskStatusLabel } from '@/components/tasks/constants'
import { api } from '@/lib/api'
import { useAllAccounts } from '@/lib/accounts'
import type { Account, Platform, TaskStatus } from '@/types'

interface DashboardStats {
  accounts: number
  contents: number
  pendingTasks: number
  runningTasks: number
  totalFollowers: number
}

const platformColors: Record<Platform, string> = {
  tiktok: '#000000',
  instagram: '#e1306c',
  youtube: '#ff0000',
  twitter: '#1da1f2',
  facebook: '#1877f2',
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function Dashboard() {
  const { data } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const accounts = useAllAccounts()
  const platformStats = aggregateByPlatform(accounts)
  const topByFollowers = [...accounts].sort((a, b) => b.followers - a.followers).slice(0, 10)

  const stats = [
    { label: '账号总数', value: data ? String(data.accounts) : '—', icon: Users },
    { label: '作品数量', value: data ? String(data.contents) : '—', icon: FileVideo },
    { label: '待执行任务', value: data ? String(data.pendingTasks + data.runningTasks) : '—', icon: CalendarClock },
    { label: '粉丝总数', value: data ? fmt(data.totalFollowers) : '—', icon: TrendingUp },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">概览</h1>
        <p className="text-muted-foreground text-sm mt-1">社交账号运营总览</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">各平台粉丝数</CardTitle>
          </CardHeader>
          <CardContent>
            {platformStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有绑定账号</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={platformStats} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="platform" tick={{ fontSize: 12 }} tickFormatter={capitalize} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} width={48} />
                  <Tooltip formatter={(v) => fmt(Number(v))} labelFormatter={capitalize} />
                  <Bar dataKey="followers" radius={[4, 4, 0, 0]}>
                    {platformStats.map((entry) => (
                      <Cell key={entry.platform} fill={platformColors[entry.platform] ?? '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">平台分布</CardTitle>
          </CardHeader>
          <CardContent>
            {platformStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有绑定账号</p>
            ) : (
              <div className="space-y-3">
                {platformStats.map(({ platform, followers, posts, count }) => (
                  <div key={platform} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={platform} />
                      <span className="text-muted-foreground text-xs">{count} 个账号</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium tabular-nums">{fmt(followers)} 粉丝</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{posts} 作品</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">最近的发布任务</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTasks />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">粉丝数排行</CardTitle>
          </CardHeader>
          <CardContent>
            {topByFollowers.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有绑定账号</p>
            ) : (
              <div className="space-y-2.5">
                {topByFollowers.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm sm:gap-3">
                    <div className="h-7 w-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {a.displayName[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">@{a.username}</p>
                    </div>
                    <PlatformBadge platform={a.platform} />
                    <span className="shrink-0 font-medium tabular-nums">{fmt(a.followers)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function aggregateByPlatform(accounts: Account[]) {
  const byPlatform = new Map<Platform, { platform: Platform; followers: number; posts: number; count: number }>()
  for (const a of accounts) {
    const row = byPlatform.get(a.platform) ?? { platform: a.platform, followers: 0, posts: 0, count: 0 }
    row.followers += a.followers
    row.posts += a.postsCount
    row.count += 1
    byPlatform.set(a.platform, row)
  }
  return [...byPlatform.values()]
}

function RecentTasks() {
  const { data } = useQuery({
    queryKey: ['tasks', 'recent'],
    queryFn: () => api.get<{ data: Array<{ id: string; status: string; scheduledAt: string; content?: { title: string } }> }>('/tasks?limit=5').then((r) => r.data),
  })

  const tasks = data?.data ?? []
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground">还没有任务</p>

  const statusColor: Record<string, string> = {
    pending: 'text-amber-500',
    running: 'text-blue-500',
    done: 'text-emerald-500',
    failed: 'text-red-500',
  }

  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-foreground">{t.content?.title ?? t.id.slice(0, 8)}</span>
          <span className={`shrink-0 font-medium ${statusColor[t.status] ?? ''}`}>
            {taskStatusLabel[t.status as TaskStatus] ?? t.status}
          </span>
        </li>
      ))}
    </ul>
  )
}

function capitalize(v: unknown) {
  const s = String(v ?? '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
