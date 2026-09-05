import type { AccountStatus } from '@/types'

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
