import { NavLink, useNavigate } from 'react-router-dom'
import {
  Users, FileVideo, Settings, Globe, LogOut,
  LayoutDashboard, ShieldCheck, Building2, Boxes, Images, Plug, ChevronRight, TrendingUp,
  MessageSquare,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useMe } from '@/lib/auth'
import { useWorkspace } from '@/lib/workspace'
import { useSiteName } from '@/lib/site'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { WORKSPACE_ROLE_LABELS } from '@/lib/workspace-labels'

const nav = [
  { to: '/', icon: LayoutDashboard, label: '概览' },
  { to: '/accounts', icon: Users, label: '账号管理' },
  { to: '/contents', icon: FileVideo, label: '作品管理' },
  { to: '/assets', icon: Images, label: '素材库' },
  { to: '/comments', icon: MessageSquare, label: '评论' },
  { to: '/analytics', icon: TrendingUp, label: '数据分析' },
  { to: '/mcp', icon: Plug, label: 'MCP 服务' },
  { to: '/workspace', icon: Building2, label: '工作空间' },
  { to: '/workspaces', icon: Boxes, label: '空间管理', adminOnly: true },
  { to: '/users', icon: ShieldCheck, label: '用户管理', adminOnly: true },
  { to: '/settings', icon: Settings, label: '系统设置', adminOnly: true },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { me, isAdmin } = useMe()
  const { workspace } = useWorkspace()
  const siteName = useSiteName()

  // 待处理评论的角标。评论是别人发来的，不刷新就看不到，所以这里自己轮询
  const { data: pending } = useQuery({
    queryKey: ['comments-pending'],
    queryFn: () => api.get<{ count: number }>('/comments/pending-count').then((r) => r.data.count),
    refetchInterval: 60_000,
  })

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <aside className="flex h-dvh w-60 flex-col border-r bg-background">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Globe className="h-5 w-5 text-primary" />
        <span className="truncate font-semibold text-sm">{siteName}</span>
      </div>
      <div className="border-b p-3">
        <WorkspaceSwitcher />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.filter((n) => !n.adminOnly || isAdmin).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
            {to === '/comments' && !!pending && (
              <span className="ml-auto rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {pending > 99 ? '99+' : pending}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        {me && (
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'mb-1 flex items-center gap-2 rounded-md px-3 py-2 transition-colors',
                isActive ? 'bg-accent' : 'hover:bg-accent',
              )
            }
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {me.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{me.displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">
                @{me.username} · {workspace ? WORKSPACE_ROLE_LABELS[workspace.role] : '无空间'}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </NavLink>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </aside>
  )
}
