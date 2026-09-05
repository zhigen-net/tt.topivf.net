import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Eye, Heart, MessageCircle, Share2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlatformBadge } from '@/components/PlatformBadge'
import { PostMetrics } from '@/components/posts/PostMetrics'
import { allPlatforms, platformLabel } from '@/components/contents/constants'
import { api } from '@/lib/api'
import { formatCount } from '@/lib/utils'
import type { PaginatedResponse, Platform, Post, PostSort, PostsSummary } from '@/types'

const ALL = 'all'
const PAGE_SIZE = 20

const sortLabel: Record<PostSort, string> = {
  publishedAt: '最新发布',
  views: '播放最多',
  likes: '点赞最多',
  comments: '评论最多',
  shares: '转发最多',
}

const summaryCards = [
  { key: 'views', icon: Eye, label: '总播放' },
  { key: 'likes', icon: Heart, label: '总点赞' },
  { key: 'comments', icon: MessageCircle, label: '总评论' },
  { key: 'shares', icon: Share2, label: '总转发' },
] as const

export default function AnalyticsPage() {
  const [sort, setSort] = useState<PostSort>('views')
  const [platform, setPlatform] = useState<Platform | typeof ALL>(ALL)
  const [page, setPage] = useState(1)

  useEffect(() => setPage(1), [sort, platform])

  const params = useMemo(() => ({
    sort,
    page,
    limit: PAGE_SIZE,
    ...(platform !== ALL ? { platform } : {}),
  }), [sort, platform, page])

  const { data: summary } = useQuery({
    queryKey: ['posts', 'summary'],
    queryFn: () => api.get<PostsSummary>('/posts/summary').then((r) => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['posts', params],
    queryFn: () => api.get<PaginatedResponse<Post>>('/posts', { params }).then((r) => r.data),
  })

  const posts = data?.data ?? []

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">数据分析</h1>
        <p className="text-muted-foreground text-sm mt-1">
          已发布作品的表现排行，指标由后台每 3 小时回收一次
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {summaryCards.map(({ key, icon: Icon, label }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold tabular-nums">
                {summary ? formatCount(summary[key]) : '—'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 没回收到指标的作品在合计里是 0，不说清楚会被当成「真的没人看」 */}
      {summary && summary.posts > summary.measured && (
        <p className="text-xs text-muted-foreground">
          共 {summary.posts} 条已发布作品，其中 {summary.measured} 条拉到了指标，
          其余 {summary.posts - summary.measured} 条尚未回收或平台不支持，未计入合计。
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={sort} onValueChange={(v) => setSort(v as PostSort)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(sortLabel) as PostSort[]).map((s) => (
              <SelectItem key={s} value={s}>{sortLabel[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={platform} onValueChange={(v) => setPlatform(v as Platform | typeof ALL)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部平台" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部平台</SelectItem>
            {allPlatforms.map((p) => (
              <SelectItem key={p} value={p}>{platformLabel[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          还没有已发布的作品。发布之后，后台会自动开始回收播放和互动数据。
        </p>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {posts.map((p, i) => (
              <div key={p.id} className="rounded-xl border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums pt-0.5">
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{p.contentTitle ?? '（作品已删除）'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.account ? `@${p.account.username}` : '账号已删除'}
                      {' · '}
                      {format(new Date(p.publishedAt), 'yyyy-MM-dd')}
                    </p>
                  </div>
                  <PlatformBadge platform={p.platform} />
                </div>
                <PostMetrics post={p} />
              </div>
            ))}
          </div>

          <div className="hidden md:block rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-12">#</th>
                  <th className="px-3 py-2 text-left font-medium">作品</th>
                  <th className="px-3 py-2 text-left font-medium">账号</th>
                  <th className="px-3 py-2 text-right font-medium">播放</th>
                  <th className="px-3 py-2 text-right font-medium">点赞</th>
                  <th className="px-3 py-2 text-right font-medium">评论</th>
                  <th className="px-3 py-2 text-right font-medium">转发</th>
                  <th className="px-3 py-2 text-left font-medium">发布时间</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {posts.map((p, i) => (
                  <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <p className="truncate max-w-[18rem]" title={p.contentTitle}>
                        {p.contentTitle ?? <span className="text-muted-foreground italic">作品已删除</span>}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <PlatformBadge platform={p.platform} />
                        <span className="text-xs truncate">
                          {p.account ? `@${p.account.username}` : (
                            <span className="text-muted-foreground italic">账号已删除</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <MetricCells post={p} />
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                      {format(new Date(p.publishedAt), 'yyyy-MM-dd')}
                    </td>
                    <td className="px-3 py-2">
                      {p.postUrl && (
                        <a
                          href={p.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="查看原帖"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                第 {page} / {data.totalPages} 页，共 {data.total} 条
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** 没回收到指标时四个数都是数据库默认值，摆成 0 会让人以为是真实数据 */
function MetricCells({ post }: { post: Post }) {
  if (!post.metricsUpdatedAt) {
    return (
      <td colSpan={4} className="px-3 py-2 text-center text-xs text-muted-foreground">
        指标待回收
      </td>
    )
  }
  return (
    <>
      {(['views', 'likes', 'comments', 'shares'] as const).map((k) => (
        <td key={k} className="px-3 py-2 text-right tabular-nums" title={post[k].toLocaleString()}>
          {formatCount(post[k])}
        </td>
      ))}
    </>
  )
}
