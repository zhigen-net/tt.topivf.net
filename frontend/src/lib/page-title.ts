import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export const APP_NAME = 'SocialHub'

// 越具体的前缀写在越前面，匹配时取第一个命中的
const TITLES: [string, string][] = [
  ['/login', '登录'],
  ['/accounts', '账号管理'],
  ['/contents', '作品管理'],
  ['/assets', '素材库'],
  ['/analytics', '数据分析'],
  ['/tasks', '发布任务'],
  ['/workspace/credentials', '平台凭据'],
  ['/workspace/proxies', '代理管理'],
  ['/workspace', '工作空间'],
  ['/mcp', 'MCP 服务'],
  ['/profile', '个人资料'],
  ['/users', '用户管理'],
  ['/settings', '系统设置'],
]

export function titleFor(pathname: string) {
  if (pathname === '/') return `概览 · ${APP_NAME}`
  const hit = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return hit ? `${hit[1]} · ${APP_NAME}` : APP_NAME
}

/** 挂在路由树顶上，换页就改标签页标题 */
export function useDocumentTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = titleFor(pathname)
  }, [pathname])
}
