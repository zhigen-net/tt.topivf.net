import { Eye, Heart, MessageCircle, Share2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { cn, formatCount } from '@/lib/utils'
import type { Post } from '@/types'

const items = [
  { key: 'views', icon: Eye, label: '播放' },
  { key: 'likes', icon: Heart, label: '点赞' },
  { key: 'comments', icon: MessageCircle, label: '评论' },
  { key: 'shares', icon: Share2, label: '转发' },
] as const

/**
 * metricsUpdatedAt 为空时那四个 0 是数据库默认值而不是真实数据，直接摆出来会被
 * 当成「这条作品没人看」。后台每 3 小时刷一批，新发的作品本来就要等一轮。
 */
export function PostMetrics({ post, className }: { post: Post; className?: string }) {
  if (!post.metricsUpdatedAt) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        指标还没回收，稍后再看
      </p>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      {items.map(({ key, icon: Icon, label }) => (
        <span
          key={key}
          title={`${label} ${post[key].toLocaleString()}`}
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="tabular-nums font-medium text-foreground">{formatCount(post[key])}</span>
        </span>
      ))}
    </div>
  )
}

export function MetricsFreshness({ post }: { post: Post }) {
  if (!post.metricsUpdatedAt) return null
  return (
    <span className="text-xs text-muted-foreground">
      {formatDistanceToNow(new Date(post.metricsUpdatedAt), { addSuffix: true, locale: zhCN })}更新
    </span>
  )
}
