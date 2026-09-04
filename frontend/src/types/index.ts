export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook'
export type AccountStatus = 'active' | 'inactive' | 'banned' | 'warming'
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed'
export type ContentType = 'video' | 'image' | 'reel' | 'story'
export type ReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type UserRole = 'admin' | 'user'
export type WorkspaceRole = 'manager' | 'member' | 'viewer'
export type AssetType = 'video' | 'image'

export interface Workspace {
  id: string
  name: string
  /** 当前登录用户在这个空间里的角色 */
  role: WorkspaceRole
  createdAt: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  user?: User
  role: WorkspaceRole
  createdAt: string
}

export interface Asset {
  id: string
  filename: string
  mimeType: string
  size: number
  type: AssetType
  duration: number | null
  uploadedBy: string | null
  createdAt: string
  /** 已被作品引用的素材不能删 */
  referenced: boolean
  /** 带短时签名的直链，过期后要重新拉列表 */
  url: string
}

export interface User {
  id: string
  username: string
  /** 登录凭据 */
  email: string
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
  credentialId?: string
  /** 平台侧账号 id：Facebook 是 pageId，Instagram 是 igUserId */
  externalId?: string
  credential?: Pick<MetaCredential, 'id' | 'label' | 'status'>
  followers: number
  following: number
  postsCount: number
  lastActiveAt?: string
  createdAt: string
}

export type CredentialStatus = 'active' | 'expiring' | 'invalid'

/** 一条 Meta 授权源，名下可以挂多个主页 / Instagram 账号 */
export interface MetaCredential {
  id: string
  label: string
  appId: string
  tokenType: string
  scopes: string[]
  /** unix 秒，0 表示永不过期 */
  expiresAt: number
  status: CredentialStatus
  lastCheckedAt?: string
  lastError?: string
  pendingTargets: CredentialTarget[]
  createdAt: string
  accountCount: number
}

export interface CredentialTarget {
  platform: 'facebook' | 'instagram'
  /** facebook 是 pageId，instagram 是 igUserId */
  externalId: string
  username: string
  displayName: string
  avatar?: string
}

export interface DiscoveredTarget extends CredentialTarget {
  followers: number
  /** 已接入的要置灰，避免重复添加 */
  linkedAccountId?: string
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
  /** 列表展示用：没设封面时会回落到配图，仅在列表接口返回 */
  coverUrl?: string
  assetId?: string | null
  thumbnailAssetId?: string | null
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

/** 任务接口回填的账号信息，账号被删掉后就不在这个数组里了 */
export interface TaskAccount {
  id: string
  username: string
  displayName: string
  platform: Platform
  avatar?: string
}

export interface PublishTask {
  id: string
  contentId: string
  content?: Content
  accountIds: string[]
  accounts?: TaskAccount[]
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

export const MCP_SCOPES = [
  'assets:read',
  'assets:write',
  'contents:read',
  'contents:write',
  'contents:review',
  'accounts:read',
  'tasks:read',
  'tasks:publish',
  'analytics:read',
] as const

export type McpScope = (typeof MCP_SCOPES)[number]

export interface ApiKey {
  id: string
  name: string
  prefix: string
  workspaceId: string
  userId: string
  user?: User
  scopes: McpScope[]
  /** null 表示不限账号 */
  accountIds?: string[] | null
  expiresAt?: string | null
  revokedAt?: string | null
  lastUsedAt?: string | null
  createdAt: string
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
