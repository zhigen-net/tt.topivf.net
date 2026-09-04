import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import { WORKSPACE_ROLE_LABELS } from '@/lib/workspace-labels'

const TABS = [
  { to: '/workspace', label: '空间设置', end: true },
  { to: '/workspace/credentials', label: '授权凭证', managerOnly: true },
  { to: '/workspace/proxies', label: '代理管理', managerOnly: true },
]

export function WorkspaceLayout() {
  const { workspace, isManager, isLoading } = useWorkspace()

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground sm:p-6">加载中…</div>
  if (!workspace) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">你还没有加入任何工作空间，请联系平台管理员。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">工作空间</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          当前空间「{workspace.name}」· 我的角色：{WORKSPACE_ROLE_LABELS[workspace.role]}
        </p>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b">
        {TABS.filter((t) => !t.managerOnly || isManager).map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
