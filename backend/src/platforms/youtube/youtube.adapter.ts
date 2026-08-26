import { Injectable, Logger } from '@nestjs/common'
import { PlatformAdapter, PostResult, AccountStats } from '../platform.adapter'
import type { Account } from '../../accounts/account.entity'
import type { Content } from '../../contents/content.entity'

@Injectable()
export class YoutubeAdapter extends PlatformAdapter {
  readonly platform = 'youtube'
  private readonly logger = new Logger(YoutubeAdapter.name)

  async publish(account: Account, content: Content): Promise<PostResult> {
    this.logger.log(`Publishing to YouTube for @${account.username}`)
    return { success: false, error: 'YouTube adapter not yet implemented' }
  }

  async fetchStats(account: Account): Promise<AccountStats> {
    return { followers: account.followers, following: account.following, postsCount: account.postsCount }
  }

  async checkHealth(account: Account): Promise<boolean> {
    return account.status === 'active'
  }
}
