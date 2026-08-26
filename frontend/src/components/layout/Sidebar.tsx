import { NavLink } from 'react-router-dom'
import { Users, FileVideo, CalendarClock, BarChart3, Settings, Globe, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/', icon: BarChart3, label: 'Dashboard' },
  { to: '/accounts', icon: Users, label: 'Accounts' },
  { to: '/contents', icon: FileVideo, label: 'Contents' },
  { to: '/tasks', icon: CalendarClock, label: 'Publish Tasks' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/proxies', icon: Wifi, label: 'Proxies' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-background">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Globe className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">SocialHub</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ to, icon: Icon, label }) => (
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
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">v0.1.0</p>
      </div>
    </aside>
  )
}
