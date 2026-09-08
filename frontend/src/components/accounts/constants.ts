import type { Account, AccountStatus } from '@/types'

export const accountStatusVariant: Record<AccountStatus, 'success' | 'destructive' | 'secondary' | 'warning'> = {
  active: 'success',
  inactive: 'secondary',
  banned: 'destructive',
  warming: 'warning',
}

export const accountStatusLabel: Record<AccountStatus, string> = {
  active: '正常',
  inactive: '停用',
  banned: '封禁',
  warming: '养号',
}

/**
 * Facebook 的 username 存的是主页名（可能带空格和中文），拼进 URL 是死链，
 * 只有 externalId（pageId）能用；其余平台的 username 就是 URL 里那个 handle。
 */
export function accountProfileUrl(
  account: Pick<Account, 'platform' | 'username' | 'externalId'>,
): string | undefined {
  const handle = encodeURIComponent(account.username)
  switch (account.platform) {
    case 'facebook':
      return account.externalId ? `https://www.facebook.com/${account.externalId}` : undefined
    case 'instagram':
      return `https://www.instagram.com/${handle}`
    case 'tiktok':
      return `https://www.tiktok.com/@${handle}`
    case 'youtube':
      return `https://www.youtube.com/@${handle}`
    case 'twitter':
      return `https://x.com/${handle}`
  }
}
