import type { ContentType, Platform } from '@/types'

export const allContentTypes: ContentType[] = ['video', 'image', 'reel', 'story']

export const contentTypeLabel: Record<ContentType, string> = {
  video: '视频',
  image: '图片',
  reel: 'Reel',
  story: '快拍',
}

export const allPlatforms: Platform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook']

export const platformLabel: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
  facebook: 'Facebook',
}
