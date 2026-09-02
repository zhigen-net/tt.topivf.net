import { NavLink, useNavigate } from 'react-router-dom'
import { Users, FileVideo, CalendarClock, BarChart3, Settings, Globe, Wifi, LogOut, LayoutDashboard, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMe } from '@/lib/auth'

const nav = [
  { to: '/', icon: LayoutDashboard, label: '概览' },
  { to: '/accounts', icon: Users, label: '账号管理' },
  { to: '/contents', icon: FileVideo, label: '作品管理' },
  { to: '/tasks', icon: CalendarClock, label: '发布任务' },
  { to: '/analytics', icon: BarChart3, label: '数据分析' },
  { to: '/proxies', icon: Wifi, label: '代理管理' },
  { to: '/users', icon: ShieldCheck, label: '用户管理', adminOnly: true },
  { to: '/settings', icon: Settings, label: '设置' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { me, isAdmin } = useMe()

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <aside className="flex h-dvh w-60 flex-col border-r bg-background">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Globe className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">SocialHub</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
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
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        {me && (
          <div className="px-3 pb-2">
            <p className="truncate text-sm font-medium">{me.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{me.username} · {isAdmin ? '管理员' : '普通用户'}
            </p>
          </div>
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
