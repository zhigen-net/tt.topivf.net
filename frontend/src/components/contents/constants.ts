import type { ContentType, Platform, ReviewStatus } from '@/types'

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

export const allReviewStatuses: ReviewStatus[] = ['draft', 'pending', 'approved', 'rejected']

export const reviewStatusLabel: Record<ReviewStatus, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
}

export const reviewStatusClass: Record<ReviewStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}
