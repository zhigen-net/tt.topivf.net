import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider, hashKey } from '@tanstack/react-query'
import { Layout } from '@/components/layout/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import LoginPage from '@/pages/auth/LoginPage'
import Dashboard from '@/pages/Dashboard'
import AccountsPage from '@/pages/accounts/AccountsPage'
import ContentsPage from '@/pages/contents/ContentsPage'
import AssetsPage from '@/pages/assets/AssetsPage'
import CommentsPage from '@/pages/comments/CommentsPage'
import AnalyticsPage from '@/pages/analytics/AnalyticsPage'
import WorkspacePage from '@/pages/workspace/WorkspacePage'
import { WorkspaceLayout } from '@/pages/workspace/WorkspaceLayout'
import TasksPage from '@/pages/tasks/TasksPage'
import ProxiesPage from '@/pages/proxies/ProxiesPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import McpPage from '@/pages/mcp/McpPage'
import CredentialsPage from '@/pages/credentials/CredentialsPage'
import ProfilePage from '@/pages/profile/ProfilePage'
import UsersPage from '@/pages/users/UsersPage'
import { useMe } from '@/lib/auth'
import { useWorkspace } from '@/lib/workspace'
import { useDocumentTitle } from '@/lib/page-title'
import { getWorkspaceId } from '@/lib/workspace-id'

/** 这几类数据不属于任何空间，切换时不该跟着失效重取 */
const GLOBAL_KEYS = new Set(['me', 'users', 'workspaces'])

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // 每份缓存都属于某个空间。统一在哈希里带上空间 id，比给几十处 queryKey 挨个补
      // 更可靠：新加的查询自动被隔离，漏写不会变成 A 空间的数据显示在 B 空间。
      queryKeyHashFn: (key) =>
        GLOBAL_KEYS.has(key[0] as string) ? hashKey(key) : hashKey([getWorkspaceId(), ...key]),
    },
  },
})

// 必须在 BrowserRouter 里面才拿得到 location，所以单独包一层
function TitleSync() {
  useDocumentTitle()
  return null
}

function RequireAuth() {
  const token = localStorage.getItem('token')
  return token ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireAdmin() {
  const { isAdmin, isLoading } = useMe()
  if (isLoading) return null
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}

function RequireWorkspaceManager() {
  const { isManager, isLoading } = useWorkspace()
  if (isLoading) return null
  return isManager ? <Outlet /> : <Navigate to="/workspace" replace />
}

export default function App() {
  return (
    <ErrorBoundary scope="应用">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TitleSync />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/contents" element={<ContentsPage />} />
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/comments" element={<CommentsPage />} />
                <Route path="/workspace" element={<WorkspaceLayout />}>
                  <Route index element={<WorkspacePage />} />
                  <Route element={<RequireWorkspaceManager />}>
                    <Route path="credentials" element={<CredentialsPage />} />
                    <Route path="proxies" element={<ProxiesPage />} />
                  </Route>
                </Route>
                {/* 这两个页面搬进工作空间了，老链接和书签别 404 */}
                <Route path="/credentials" element={<Navigate to="/workspace/credentials" replace />} />
                <Route path="/proxies" element={<Navigate to="/workspace/proxies" replace />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/mcp" element={<McpPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route element={<RequireAdmin />}>
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
