import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Account, PaginatedResponse } from '@/types'

/**
 * 账号选择器用的全量列表（列表页那份是分页的，默认只有 20 条）。
 * 必须走这一个入口：多处各写各的 queryFn 但共用同一个 queryKey 时，
 * 先落缓存的那份形状会被喂给其它组件，取到的可能不是数组。
 */
export function useAllAccounts(enabled = true) {
  const { data } = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => api.get<PaginatedResponse<Account>>('/accounts', { params: { limit: 500 } })
      .then((r) => r.data.data),
    enabled,
  })
  return data ?? []
}
