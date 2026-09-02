export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook'
export type AccountStatus = 'active' | 'inactive' | 'banned' | 'warming'
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed'
export type ContentType = 'video' | 'image' | 'reel' | 'story'
export type ReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type UserRole = 'admin' | 'user'

export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
}

export interface Account {
  id: string
  platform: Platform
  username: string
  displayName: string
  avatar?: string
  status: AccountStatus
  proxyId?: string
  groupId?: string
  followers: number
  following: number
  postsCount: number
  lastActiveAt?: string
  createdAt: string
}

export interface AccountGroup {
  id: string
  name: string
  description?: string
  color: string
  accountCount: number
}

export interface Proxy {
  id: string
  host: string
  port: number
  protocol: 'http' | 'socks5'
  username?: string
  label?: string
  country?: string
  isHealthy: boolean
  lastCheckedAt?: string
}

export interface Content {
  id: string
  title: string
  type: ContentType
  fileUrl?: string
  thumbnailUrl?: string
  caption?: string
  hashtags: string[]
  platforms: Platform[]
  size?: number
  duration?: number
  reviewStatus: ReviewStatus
  reviewNote?: string
  reviewedAt?: string
  reviewedBy?: string
  createdById?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
  taskCount: number
  doneCount: number
  failedCount: number
  lastPublishedAt: string | null
}

export interface PublishTask {
  id: string
  contentId: string
  content?: Content
  accountIds: string[]
  platforms: Platform[]
  status: TaskStatus
  scheduledAt: string
  completedAt?: string
  results: TaskResult[]
  createdAt: string
}

export interface TaskResult {
  accountId: string
  platform: Platform
  success: boolean
  postUrl?: string
  error?: string
}

export interface Stats {
  accountId: string
  platform: Platform
  followers: number
  following: number
  likes: number
  views: number
  comments: number
  recordedAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  data: T
  message?: string
}
