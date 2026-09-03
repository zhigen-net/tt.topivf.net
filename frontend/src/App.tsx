import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/layout/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import LoginPage from '@/pages/auth/LoginPage'
import Dashboard from '@/pages/Dashboard'
import AccountsPage from '@/pages/accounts/AccountsPage'
import ContentsPage from '@/pages/contents/ContentsPage'
import AssetsPage from '@/pages/assets/AssetsPage'
import WorkspacePage from '@/pages/workspace/WorkspacePage'
import TasksPage from '@/pages/tasks/TasksPage'
import ProxiesPage from '@/pages/proxies/ProxiesPage'
import AnalyticsPage from '@/pages/analytics/AnalyticsPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import McpPage from '@/pages/mcp/McpPage'
import ProfilePage from '@/pages/profile/ProfilePage'
import UsersPage from '@/pages/users/UsersPage'
import { useMe } from '@/lib/auth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function RequireAuth() {
  const token = localStorage.getItem('token')
  return token ? <Outlet /> : <Navigate to="/login" replace />
}

function RequireAdmin() {
  const { isAdmin, isLoading } = useMe()
  if (isLoading) return null
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}

export default function App() {
  return (
    <ErrorBoundary scope="应用">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/contents" element={<ContentsPage />} />
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/proxies" element={<ProxiesPage />} />
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
