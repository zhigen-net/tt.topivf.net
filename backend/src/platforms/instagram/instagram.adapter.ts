import { Injectable, Logger } from '@nestjs/common'
import { PlatformAdapter, PostResult, AccountStats } from '../platform.adapter'
import { BrowserManager } from '../browser-manager.service'
import type { Account } from '../../accounts/account.entity'
import type { Content } from '../../contents/content.entity'

@Injectable()
export class InstagramAdapter extends PlatformAdapter {
  readonly platform = 'instagram'
  private readonly logger = new Logger(InstagramAdapter.name)

  constructor(private readonly browserManager: BrowserManager) {
    super()
  }

  async publish(account: Account, content: Content): Promise<PostResult> {
    this.logger.log(`Publishing to Instagram for @${account.username}`)
    return { success: false, error: 'Instagram adapter not yet implemented' }
  }

  async fetchStats(account: Account): Promise<AccountStats> {
    return { followers: account.followers, following: account.following, postsCount: account.postsCount }
  }

  async checkHealth(account: Account): Promise<boolean> {
    return account.status === 'active'
  }
}
