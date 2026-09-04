import { CheckCircle2, XCircle, Clock, Loader2, ExternalLink } from 'lucide-react'
import { PlatformBadge } from '@/components/PlatformBadge'
import type { Platform, PublishTask } from '@/types'

export function TaskResultList({ task }: { task: PublishTask }) {
  const pendingIds = task.accountIds.filter((id) => !task.results.some((r) => r.accountId === id))

  if (task.results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        {task.status === 'pending' ? (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <p className="text-sm">排队中，等待发布…</p>
          </div>
        ) : task.status === 'running' ? (
          <div className="flex flex-col items-center gap-1.5 text-blue-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">正在发布…</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">没有留下执行结果。</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border divide-y overflow-hidden">
      {task.results.map((r) => (
        <div key={r.accountId} className="flex items-center gap-3 px-3 py-2.5">
          {r.success
            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            : <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <AccountLine task={task} accountId={r.accountId} platform={r.platform} />
            {r.error && <p className="text-xs text-red-500 mt-0.5 break-words">{r.error}</p>}
          </div>
          {r.postUrl && (
            <a
              href={r.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="查看原帖"
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      ))}

      {pendingIds.map((id) => (
        <div key={id} className="flex items-center gap-3 px-3 py-2.5">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <AccountLine task={task} accountId={id} />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">待发布</span>
        </div>
      ))}
    </div>
  )
}

function AccountLine({ task, accountId, platform }: {
  task: PublishTask
  accountId: string
  platform?: Platform
}) {
  const account = task.accounts?.find((a) => a.id === accountId)
  const shown = platform ?? account?.platform
  return (
    <div className="flex items-center gap-2 min-w-0">
      {shown && <PlatformBadge platform={shown} />}
      {account ? (
        <span className="text-xs truncate">
          {account.displayName}
          <span className="text-muted-foreground"> @{account.username}</span>
        </span>
      ) : (
        // 账号删了历史任务还在，只剩一串 uuid，说清楚比显示 id 前缀有用
        <span className="text-xs text-muted-foreground italic">账号已删除</span>
      )}
    </div>
  )
}
