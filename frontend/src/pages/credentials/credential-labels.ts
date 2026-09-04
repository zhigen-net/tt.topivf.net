import type { CredentialStatus } from '@/types'

export const STATUS_LABELS: Record<CredentialStatus, string> = {
  active: '正常',
  expiring: '即将到期',
  invalid: '已失效',
}

export const STATUS_VARIANTS: Record<CredentialStatus, 'success' | 'warning' | 'destructive'> = {
  active: 'success',
  expiring: 'warning',
  invalid: 'destructive',
}

export function describeExpiry(expiresAt: number): string {
  if (!expiresAt) return '永不过期'
  const days = Math.ceil((expiresAt * 1000 - Date.now()) / 86_400_000)
  if (days <= 0) return '已过期'
  return `${new Date(expiresAt * 1000).toLocaleDateString('zh-CN')} 到期（还剩 ${days} 天）`
}

/** 提示要粘的是哪种令牌，两个弹窗共用一份，避免说法不一致 */
export const TOKEN_HINT =
  '在商务管理平台「商务设置 → 用户 → 系统用户」生成，需勾选 pages_show_list、' +
  'pages_read_engagement、pages_manage_posts；要接入 Instagram 还需 instagram_basic、' +
  'instagram_content_publish。令牌会加密保存，用于后续批量刷新主页凭证。'
