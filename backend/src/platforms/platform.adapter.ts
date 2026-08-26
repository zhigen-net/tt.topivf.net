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

export abstract class PlatformAdapter {
  abstract readonly platform: string

  abstract publish(account: Account, content: Content): Promise<PostResult>
  abstract fetchStats(account: Account): Promise<AccountStats>
  abstract checkHealth(account: Account): Promise<boolean>
}
