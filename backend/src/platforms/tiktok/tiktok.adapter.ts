import { Injectable } from '@nestjs/common'
import { PlatformAdapter, PostResult, AccountStats } from '../platform.adapter'
import { TiktokApiAdapter } from './tiktok-api.adapter'
import { TiktokBrowserAdapter } from './tiktok-browser.adapter'
import { readSession } from './tiktok-token.service'
import type { Account } from '../../accounts/account.entity'
import type { Content } from '../../contents/content.entity'

/**
 * 官方 API 和浏览器自动化两条路并存。走官方的前提是账号完成过 OAuth 授权；
 * 存量账号只有 cookie，仍旧回退到浏览器，等重新授权后自动切过去。
 */
@Injectable()
export class TiktokAdapter extends PlatformAdapter {
  readonly platform = 'tiktok'

  constructor(
    private readonly api: TiktokApiAdapter,
    private readonly browser: TiktokBrowserAdapter,
  ) {
    super()
  }

  publish(account: Account, content: Content): Promise<PostResult> {
    return this.pick(account).publish(account, content)
  }

  fetchStats(account: Account): Promise<AccountStats> {
    return this.pick(account).fetchStats(account)
  }

  checkHealth(account: Account): Promise<boolean> {
    return this.pick(account).checkHealth(account)
  }

  private pick(account: Account): PlatformAdapter {
    return readSession(account) ? this.api : this.browser
  }
}
