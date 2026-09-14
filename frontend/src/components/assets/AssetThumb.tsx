import { cn } from '@/lib/utils'
import type { Asset } from '@/types'

/**
 * 图片走后端压好的小图，没有就退回原图。
 * 视频没有服务端缩略图，挂 #t=0.1 让浏览器自己跳到第一帧渲染出来——
 * 比放个灰图标强得多，代价只是拉视频开头的几百 KB。
 *
 * 一律 object-contain：素材大多是 9:16 竖版，object-cover 会把它裁得只剩中间一条。
 */
export function AssetThumb({ asset, className }: { asset: Asset; className?: string }) {
  if (asset.type === 'image') {
    return (
      <img
        src={asset.thumbUrl ?? asset.url}
        alt={asset.filename}
        loading="lazy"
        className={cn('bg-muted object-contain', className)}
      />
    )
  }

  return (
    <video
      src={`${asset.url}#t=0.1`}
      preload="metadata"
      muted
      playsInline
      className={cn('bg-muted object-contain', className)}
    />
  )
}
