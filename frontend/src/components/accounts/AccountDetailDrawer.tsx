import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Wifi, WifiOff,
  Users, UserCheck, Film, Pencil, ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerTitle } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlatformBadge } from '@/components/PlatformBadge'
import { contentTypeLabel } from '@/components/contents/constants'
import { taskStatusLabel } from '@/components/tasks/constants'
import {
  accountStatusLabel as statusLabel, accountStatusVariant as statusVariant,
} from './constants'
import { AccountEditForm } from './AccountEditForm'
import { api } from '@/lib/api'
import type { Account, PaginatedResponse, Proxy, PublishTask, TaskStatus } from '@/types'

// 记录本次页面会话内已自动同步过的账号，避免重复请求
const autoSyncedIds = new Set<string>()

interface SyncResult extends Account {
  healthy: boolean
}

const taskStatusClass: Record<TaskStatus, string> = {
  pending: 'text-muted-foreground',
  running: 'text-blue-600',
  done: 'text-emerald-600',
  failed: 'text-destructive',
}

interface Props {
  account: Account | null
  /** 从列表的编辑按钮进来时直接展开表单 */
  initialMode?: 'view' | 'edit'
  onClose: () => void
}

export function AccountDetailDrawer({ account, initialMode = 'view', onClose }: Props) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode)
  const [syncData, setSyncData] = useState<SyncResult | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  // 用于展示的账号数据：优先用同步结果，否则用原始数据
  const display = syncData ?? account

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'by-account', account?.id],
    queryFn: () => api
      .get<PaginatedResponse<PublishTask>>('/tasks', { params: { accountId: account!.id, limit: 20 } })
      .then((r) => r.data),
    enabled: Boolean(account),
  })

  const { data: proxies } = useQuery({
    queryKey: ['proxies'],
    queryFn: () => api.get<Proxy[]>('/proxies').then((r) => r.data),
    enabled: Boolean(account?.proxyId),
  })

  const statusToggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
      api.patch(`/accounts/${id}/status`, { status }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setSyncData((prev) => prev ? { ...prev, status: res.data.status } : prev)
    },
  })

  async function doSync(accountId: string) {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await api.post<SyncResult>(`/accounts/${accountId}/sync`)
      setSyncData(res.data)
      qc.invalidateQueries({ queryKey: ['accounts'] })
    } catch {
      setSyncError('同步失败，请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  // 首次打开时自动同步一次
  useEffect(() => {
    if (!account) return
    setSyncData(null)
    setSyncError(null)
    setMode(initialMode)

    if (!autoSyncedIds.has(account.id)) {
      autoSyncedIds.add(account.id)
      doSync(account.id)
    }
  }, [account?.id])

  if (!account) return null

  const nextStatus: AccountStatus = display?.status === 'active' ? 'inactive' : 'active'
  const proxy = proxies?.find((p) => p.id === account.proxyId)
  const records = tasks?.data ?? []

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="sr-only">账号详情</DrawerTitle>
          <div className="flex items-start gap-4 pr-8">
            {display?.avatar ? (
              <img src={display.avatar} alt="" className="h-14 w-14 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold shrink-0">
                {display?.displayName?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-base truncate">{display?.displayName}</span>
                <Badge variant={statusVariant[display?.status ?? 'inactive']}>
                  {statusLabel[display?.status ?? 'inactive']}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">@{display?.username}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <PlatformBadge platform={account.platform} />
                {syncData !== null && (
                  syncData.healthy
                    ? <span className="flex items-center gap-1 text-xs text-emerald-600"><Wifi className="h-3 w-3" />登录有效</span>
                    : <span className="flex items-center gap-1 text-xs text-red-500"><WifiOff className="h-3 w-3" />{account.platform === 'facebook' ? '授权已失效' : 'Cookie 已失效'}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {mode === 'view' && (
                <Button variant="outline" size="sm" onClick={() => setMode('edit')}>
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </Button>
              )}
            </div>
          </div>
        </DrawerHeader>

        {mode === 'edit' ? (
          <DrawerBody>
            <AccountEditForm
              key={account.id}
              account={account}
              onCancel={() => setMode('view')}
              onSaved={() => setMode('view')}
            />
          </DrawerBody>
        ) : (
        <DrawerBody>
          <Section
            title="数据统计"
            action={
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => doSync(account.id)} disabled={syncing}>
                <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '同步中…' : '刷新'}
              </Button>
            }
          >
            {syncError && <p className="text-xs text-destructive mb-2">{syncError}</p>}
            <div className="grid grid-cols-3 divide-x rounded-xl border bg-muted/30 py-3">
              <StatCell icon={<Users className="h-3.5 w-3.5" />} label="粉丝" value={fmtNum(display?.followers ?? 0)} loading={syncing} />
              <StatCell icon={<UserCheck className="h-3.5 w-3.5" />} label="关注" value={fmtNum(display?.following ?? 0)} loading={syncing} />
              <StatCell icon={<Film className="h-3.5 w-3.5" />} label="作品" value={fmtNum(display?.postsCount ?? 0)} loading={syncing} />
            </div>
          </Section>

          <Section title={`发布记录${records.length > 0 ? ` · ${tasks?.total ?? records.length}` : ''}`}>
            {tasksLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg border bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                这个账号还没有发布记录。
              </p>
            ) : (
              <div className="rounded-xl border divide-y">
                {records.map((task) => {
                  const result = task.results?.find((r) => r.accountId === account.id)
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{task.content?.title ?? '（作品已删除）'}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.content && `${contentTypeLabel[task.content.type]} · `}
                          {formatDistanceToNow(new Date(task.scheduledAt), { addSuffix: true, locale: zhCN })}
                          {result?.error && <span className="text-destructive"> · {result.error}</span>}
                        </p>
                      </div>
                      <span className={`text-xs shrink-0 ${taskStatusClass[task.status]}`}>
                        {taskStatusLabel[task.status]}
                      </span>
                      {result?.postUrl && (
                        <a
                          href={result.postUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="查看贴文"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          <Section title="配置">
            <div className="rounded-xl border divide-y text-sm">
              <InfoRow label="状态">
                <button
                  className="cursor-pointer disabled:opacity-50"
                  disabled={statusToggle.isPending}
                  onClick={() => display && statusToggle.mutate({ id: account.id, status: nextStatus })}
                  title={`点击切换为${statusLabel[nextStatus]}`}
                >
                  <Badge variant={statusVariant[display?.status ?? 'inactive']}>
                    {statusLabel[display?.status ?? 'inactive']}
                  </Badge>
                </button>
              </InfoRow>
              <InfoRow label="代理">
                <span className="text-muted-foreground">
                  {account.proxyId
                    ? proxy ? `${proxy.protocol}://${proxy.host}:${proxy.port}${proxy.label ? ` · ${proxy.label}` : ''}` : '加载中…'
                    : '未设置'}
                </span>
              </InfoRow>
              <InfoRow label="分组">
                <span className="text-muted-foreground">{account.groupId ?? '未分组'}</span>
              </InfoRow>
              <InfoRow label="登录凭证">
                {syncData !== null ? (
                  syncData.healthy
                    ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />有效</span>
                    : <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3.5 w-3.5" />已失效</span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" />待检测</span>
                )}
              </InfoRow>
              <InfoRow label="上次同步">
                <span className="text-muted-foreground">
                  {display?.lastActiveAt
                    ? formatDistanceToNow(new Date(display.lastActiveAt), { addSuffix: true, locale: zhCN })
                    : '从未同步'}
                </span>
              </InfoRow>
              <InfoRow label="添加时间">
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(account.createdAt), { addSuffix: true, locale: zhCN })}
                </span>
              </InfoRow>
              <InfoRow label="账号 ID">
                <span className="text-muted-foreground font-mono text-xs">{account.id}</span>
              </InfoRow>
            </div>
          </Section>
        </DrawerBody>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function Section({ title, action, children }: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function StatCell({ icon, label, value, loading }: {
  icon: React.ReactNode
  label: string
  value: string
  loading: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={`font-semibold text-sm tabular-nums ${loading ? 'animate-pulse text-muted-foreground' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="min-w-0 truncate text-right">{children}</div>
    </div>
  )
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
