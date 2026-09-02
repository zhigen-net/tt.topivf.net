import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlatformBadge } from '@/components/PlatformBadge'
import { api } from '@/lib/api'
import type { Account, Platform } from '@/types'

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

export default function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ['accounts', 'analytics'],
    queryFn: () => api.get<{ data: Account[] }>('/accounts?limit=100').then((r) => r.data),
    refetchInterval: 60_000,
  })

  const accounts = data?.data ?? []
  const activeAccounts = accounts.filter((a) => a.status === 'active')

  const platformStats = Object.entries(
    accounts.reduce<Record<string, { followers: number; posts: number; count: number }>>((acc, a) => {
      if (!acc[a.platform]) acc[a.platform] = { followers: 0, posts: 0, count: 0 }
      acc[a.platform].followers += a.followers
      acc[a.platform].posts += a.postsCount
      acc[a.platform].count += 1
      return acc
    }, {}),
  ).map(([platform, stats]) => ({ platform: platform as Platform, ...stats }))

  const topByFollowers = [...accounts]
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 10)

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">数据分析</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {activeAccounts.length} 个正常账号 · 共 {accounts.length} 个
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 sm:p-16 text-center">
          <p className="text-sm text-muted-foreground">添加账号后才有数据</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">各平台粉丝数</CardTitle>
              </CardHeader>
              <CardContent>
                {platformStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无数据</p>
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
                <CardTitle className="text-sm font-medium">平台汇总</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {platformStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无账号</p>
                  ) : (
                    platformStats.map(({ platform, followers, posts, count }) => (
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
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">粉丝数排行</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function capitalize(v: unknown) {
  const s = String(v ?? '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
