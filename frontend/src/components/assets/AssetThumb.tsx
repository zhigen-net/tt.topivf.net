import { FileVideo } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Asset } from '@/types'

/** 视频不做预览图，直接放个占位；签名直链本身够拉整段视频，没必要为缩略图再多传一次 */
export function AssetThumb({ asset, className }: { asset: Asset; className?: string }) {
  if (asset.type === 'image') {
    return (
      <img
        src={asset.url}
        alt={asset.filename}
        loading="lazy"
        className={cn('bg-muted object-cover', className)}
      />
    )
  }
  return (
    <div className={cn('flex items-center justify-center bg-muted', className)}>
      <FileVideo className="h-8 w-8 text-muted-foreground" />
    </div>
  )
}
