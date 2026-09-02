import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { User } from '@/types'

/** 当前登录用户。角色和停用状态由后端每次请求实时判定，前端这份只用于显隐 */
export function useMe() {
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/auth/me').then((r) => r.data),
    staleTime: 5 * 60_000,
    retry: false,
  })

  return { me: data, isAdmin: data?.role === 'admin', isLoading }
}
