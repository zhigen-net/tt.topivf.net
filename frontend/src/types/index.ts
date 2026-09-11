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
  /** 可撤销的长期分享链接，没开或已过期都是 null */
  shareUrl: string | null
  shareExpiresAt: string | null
}

/** 用户所属空间，只有管理员视角的 GET /users 会返回 */
export interface UserWorkspace {
  id: string
  name: string
  role: WorkspaceRole
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
  workspaces?: UserWorkspace[]
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
  /** 给 AI 的更新说明/要求，会被拼进 MCP 写类工具的描述 */
  brief?: string
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

/** 与后端 CredentialErrorCode 一一对应，前端按它把用户送到教程的对应小节 */
export type CredentialErrorCode =
  | 'PAGE_TOKEN'
  | 'SHORT_LIVED'
  | 'MISSING_SCOPES'
  | 'NO_PAGES'
  | 'TOKEN_INVALID'
  | 'RATE_LIMITED'
  | 'NO_ENCRYPTION_KEY'
  | 'GRAPH_ERROR'

export interface CredentialProblem {
  code: CredentialErrorCode
  message: string
}

/** 令牌体检结果，粘贴前的只读预检，不落库 */
export interface TokenReport {
  tokenType: string
  appId: string
  scopes: string[]
  missingScopes: string[]
  requiredScopes: string[]
  expiresAt: number
  /** 本系统换不动长期令牌时给出的原因，空串表示能换 */
  exchangeBlocker: string
  pageCount: number
  instagramCount: number
  pages: Array<{ name: string; followers: number; instagram: string | null }>
  problems: CredentialProblem[]
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

/** GET /contents/:id/preview 的返回。签名直链十分钟过期，所以点开预览时才取 */
export interface ContentPreviewMedia {
  mediaUrl: string | null
  mediaKind: 'video' | 'image' | null
  coverUrl: string | null
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
  /** 平台侧作品 id，用它跟 posts 表对上才能拿到指标 */
  postId?: string
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

/** 一条作品在某个账号上的发布结果，指标由后台调度器定期回收 */
export interface Post {
  id: string
  contentId: string
  accountId: string
  platform: Platform
  platformPostId: string
  postUrl?: string
  publishedAt: string
  views: number
  likes: number
  comments: number
  shares: number
  /** 为空表示还没成功拉到过指标，此时那几个 0 不是真实值 */
  metricsUpdatedAt?: string
  /** 连续失败太多次已放弃，不会再有指标了。阈值在后端，前端只认这个布尔值 */
  metricsAbandoned?: boolean
  account?: Pick<Account, 'id' | 'username' | 'displayName' | 'platform' | 'avatar'>
  contentTitle?: string
}

export type PostSort = 'publishedAt' | 'views' | 'likes' | 'comments' | 'shares'

export interface PostsSummary {
  posts: number
  views: number
  likes: number
  comments: number
  shares: number
  /** 已成功拉到过指标的条数，用来说明合计覆盖了多少 */
  measured: number
}

export type CommentStatus = 'pending' | 'replied' | 'ignored' | 'all'

export interface Comment {
  id: string
  accountId: string
  platform: Platform
  platformCommentId: string
  platformPostId: string
  parentCommentId?: string | null
  authorId?: string | null
  authorName?: string | null
  message: string
  postedAt: string
  repliedAt?: string | null
  ignoredAt?: string | null
  createdAt: string
  account?: Pick<Account, 'id' | 'username' | 'displayName' | 'platform' | 'avatar'>
  /** 我们已经回过的内容，跟在评论后面展示 */
  reply?: { message: string; postedAt: string } | null
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
  'comments:read',
  'comments:write',
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
