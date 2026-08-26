import { Injectable, Logger } from '@nestjs/common'
import { PlatformAdapter, PostResult, AccountStats } from '../platform.adapter'
import type { Account } from '../../accounts/account.entity'
import type { Content } from '../../contents/content.entity'

@Injectable()
export class TiktokAdapter extends PlatformAdapter {
  readonly platform = 'tiktok'
  private readonly logger = new Logger(TiktokAdapter.name)

  async publish(account: Account, content: Content): Promise<PostResult> {
    this.logger.log(`Publishing to TikTok for @${account.username}`)
    // TODO: implement via Playwright or TikTok API
    return { success: false, error: 'TikTok adapter not yet implemented' }
  }

  async fetchStats(account: Account): Promise<AccountStats> {
    // TODO: scrape or use API
    return { followers: account.followers, following: account.following, postsCount: account.postsCount }
  }

  async checkHealth(account: Account): Promise<boolean> {
    return account.status === 'active'
  }
}
