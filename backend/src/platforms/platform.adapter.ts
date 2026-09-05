import type { Account } from '../accounts/account.entity'
import type { Content } from '../contents/content.entity'

export interface PostResult {
  success: boolean
  postUrl?: string
  postId?: string
  error?: string
}

export interface AccountStats {
  followers: number
  following: number
  postsCount: number
}

export interface PostMetrics {
  views: number
  likes: number
  comments: number
  shares: number
}

export abstract class PlatformAdapter {
  abstract readonly platform: string

  abstract publish(account: Account, content: Content): Promise<PostResult>
  abstract fetchStats(account: Account): Promise<AccountStats>
  abstract checkHealth(account: Account): Promise<boolean>

  /**
   * 拉某条已发布作品的指标。返回 null 表示这个平台/这条授权拿不到，
   * 调度器会据此跳过而不是把它当成「全是 0」写回去。
   */
  fetchPostMetrics(_account: Account, _platformPostId: string): Promise<PostMetrics | null> {
    return Promise.resolve(null)
  }
}
