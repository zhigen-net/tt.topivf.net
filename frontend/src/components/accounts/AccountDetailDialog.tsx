import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Wifi, WifiOff,
  Users, UserCheck, Film, Calendar,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlatformBadge } from '@/components/PlatformBadge'
import { api } from '@/lib/api'
import type { Account, AccountStatus } from '@/types'

// 记录本次页面会话内已自动同步过的账号，避免重复请求
const autoSyncedIds = new Set<string>()

interface SyncResult extends Account {
  healthy: boolean
}

const statusVariant: Record<AccountStatus, 'success' | 'destructive' | 'secondary' | 'warning'> = {
  active: 'success',
  inactive: 'secondary',
  banned: 'destructive',
  warming: 'warning',
}

const statusLabel: Record<AccountStatus, string> = {
  active: '正常',
  inactive: '停用',
  banned: '封禁',
  warming: '养号',
}

interface Props {
  account: Account | null
  onClose: () => void
}

export function AccountDetailDialog({ account, onClose }: Props) {
  const qc = useQueryClient()
  const [syncData, setSyncData] = useState<SyncResult | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  // 用于展示的账号数据：优先用同步结果，否则用原始数据
  const display = syncData ?? account

  const statusToggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
      api.patch(`/accounts/${id}/status`, { status }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      // 同步更新本地 syncData 里的 status
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

    if (!autoSyncedIds.has(account.id)) {
      autoSyncedIds.add(account.id)
      doSync(account.id)
    }
  }, [account?.id])

  if (!account) return null

  const nextStatus: AccountStatus = display?.status === 'active' ? 'inactive' : 'active'

  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">账号详情</DialogTitle>
        </DialogHeader>

        {/* ── 头部：头像 + 基本信息 ── */}
        <div className="flex items-start gap-4">
          {display?.avatar ? (
            <img
              src={display.avatar}
              alt={display.displayName}
              className="h-16 w-16 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold flex-shrink-0">
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
        </div>

        {/* ── 数据统计 ── */}
        <div className="rounded-xl border bg-muted/30">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">数据统计</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => doSync(account.id)}
              disabled={syncing}
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '同步中…' : '刷新'}
            </Button>
          </div>

          {syncError && (
            <p className="px-4 pb-2 text-xs text-destructive">{syncError}</p>
          )}

          <div className="grid grid-cols-3 divide-x px-0 pb-3">
            <StatCell
              icon={<Users className="h-3.5 w-3.5" />}
              label="粉丝"
              value={fmtNum(display?.followers ?? 0)}
              loading={syncing}
            />
            <StatCell
              icon={<UserCheck className="h-3.5 w-3.5" />}
              label="关注"
              value={fmtNum(display?.following ?? 0)}
              loading={syncing}
            />
            <StatCell
              icon={<Film className="h-3.5 w-3.5" />}
              label="作品"
              value={fmtNum(display?.postsCount ?? 0)}
              loading={syncing}
            />
          </div>

          {display?.lastActiveAt && (
            <p className="px-4 pb-3 text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              上次同步：{formatDistanceToNow(new Date(display.lastActiveAt), { addSuffix: true, locale: zhCN })}
            </p>
          )}
        </div>

        {/* ── 配置信息 ── */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">配置</p>
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
              <span className="text-muted-foreground">{account.proxyId ? account.proxyId.slice(0, 8) + '…' : '未设置'}</span>
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
            <InfoRow label="添加时间">
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(account.createdAt), { addSuffix: true, locale: zhCN })}
              </span>
            </InfoRow>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatCell({ icon, label, value, loading }: {
  icon: React.ReactNode
  label: string
  value: string
  loading: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2 px-3">
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
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
