import { cn } from '@/lib/utils'
import type { Platform } from '@/types'

const config: Record<Platform, { label: string; color: string }> = {
  tiktok: { label: 'TikTok', color: 'bg-black text-white' },
  instagram: { label: 'Instagram', color: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white' },
  youtube: { label: 'YouTube', color: 'bg-red-600 text-white' },
  twitter: { label: 'X / Twitter', color: 'bg-sky-500 text-white' },
  facebook: { label: 'Facebook', color: 'bg-blue-600 text-white' },
}

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  const { label, color } = config[platform]
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', color, className)}>
      {label}
    </span>
  )
}
