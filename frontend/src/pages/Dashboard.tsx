import { Users, FileVideo, CalendarClock, TrendingUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

interface DashboardStats {
  accounts: number
  contents: number
  pendingTasks: number
  runningTasks: number
  totalFollowers: number
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

  const stats = [
    { label: 'Total Accounts', value: data ? String(data.accounts) : '—', icon: Users },
    { label: 'Content Library', value: data ? String(data.contents) : '—', icon: FileVideo },
    { label: 'Pending Tasks', value: data ? String(data.pendingTasks + data.runningTasks) : '—', icon: CalendarClock },
    { label: 'Total Followers', value: data ? fmt(data.totalFollowers) : '—', icon: TrendingUp },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your social media accounts</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Publish Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentTasks />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <PlatformDistribution />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function RecentTasks() {
  const { data } = useQuery({
    queryKey: ['tasks', 'recent'],
    queryFn: () => api.get<{ data: Array<{ id: string; status: string; scheduledAt: string; content?: { title: string } }> }>('/tasks?limit=5').then((r) => r.data),
  })

  const tasks = data?.data ?? []
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground">No tasks yet.</p>

  const statusColor: Record<string, string> = {
    pending: 'text-amber-500',
    running: 'text-blue-500',
    done: 'text-emerald-500',
    failed: 'text-red-500',
  }

  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center justify-between text-sm">
          <span className="truncate max-w-[180px] text-foreground">{t.content?.title ?? t.id.slice(0, 8)}</span>
          <span className={`capitalize font-medium ${statusColor[t.status] ?? ''}`}>{t.status}</span>
        </li>
      ))}
    </ul>
  )
}

function PlatformDistribution() {
  const { data } = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => api.get<{ data: Array<{ platform: string }> }>('/accounts?limit=100').then((r) => r.data),
  })

  const accounts = data?.data ?? []
  if (accounts.length === 0) return <p className="text-sm text-muted-foreground">No accounts connected.</p>

  const counts: Record<string, number> = {}
  for (const a of accounts) counts[a.platform] = (counts[a.platform] ?? 0) + 1

  const colors: Record<string, string> = {
    tiktok: 'bg-black',
    instagram: 'bg-pink-500',
    youtube: 'bg-red-600',
    twitter: 'bg-sky-500',
    facebook: 'bg-blue-600',
  }

  return (
    <ul className="space-y-2">
      {Object.entries(counts).map(([platform, count]) => (
        <li key={platform} className="flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${colors[platform] ?? 'bg-muted'}`} />
          <span className="capitalize flex-1">{platform}</span>
          <span className="font-medium">{count}</span>
        </li>
      ))}
    </ul>
  )
}
