import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export const DEFAULT_SITE_NAME = 'SocialHub'

/** 登录页也要用，所以这条查询不能依赖 token；后端那个接口是免鉴权的 */
export function useSiteName() {
  const { data } = useQuery({
    queryKey: ['site-settings'],
    queryFn: () => api.get<{ siteName: string }>('/settings').then((r) => r.data.siteName),
    staleTime: Infinity,
  })
  return data ?? DEFAULT_SITE_NAME
}
