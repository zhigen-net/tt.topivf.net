import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { AddCredentialDialog } from './AddCredentialDialog'
import { RotateTokenDialog } from './RotateTokenDialog'
import { LinkTargetsDialog } from './LinkTargetsDialog'
import { describeExpiry, STATUS_LABELS, STATUS_VARIANTS } from './credential-labels'
import type { MetaCredential } from '@/types'

export default function CredentialsPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState<MetaCredential | null>(null)
  const [rotateTarget, setRotateTarget] = useState<MetaCredential | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => api.get<MetaCredential[]>('/credentials').then((r) => r.data),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/credentials/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credentials'] }),
  })

  const credentials = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 max-w-2xl text-sm text-muted-foreground">
          一条令牌可以接入名下所有主页和 Instagram 账号，换令牌时无需逐个账号重新绑定
        </p>
        <Button className="shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          添加凭证
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : !credentials.length ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">还没有托管的授权凭证</p>
          <p className="mt-1 text-sm text-muted-foreground">
            粘一次商务管理平台的系统用户令牌，就能批量接入名下的主页和 Instagram 账号
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {credentials.map((c) => (
            <CredentialCard
              key={c.id}
              credential={c}
              onLink={() => setLinkTarget(c)}
              onRotate={() => setRotateTarget(c)}
              onRemove={() => {
                if (confirm(`删除凭证「${c.label}」？下挂的 ${c.accountCount} 个账号会保留，但之后不能再批量刷新。`)) {
                  remove.mutate(c.id)
                }
              }}
            />
          ))}
        </div>
      )}

      <AddCredentialDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <LinkTargetsDialog credential={linkTarget} onClose={() => setLinkTarget(null)} />
      <RotateTokenDialog credential={rotateTarget} onClose={() => setRotateTarget(null)} />
    </div>
  )
}

function CredentialCard({ credential: c, onLink, onRotate, onRemove }: {
  credential: MetaCredential
  onLink: () => void
  onRotate: () => void
  onRemove: () => void
}) {
  const qc = useQueryClient()

  const refresh = useMutation({
    mutationFn: () => api.post<{ updated: number; orphaned: string[] }>(`/credentials/${c.id}/refresh`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['credentials'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      const { updated, orphaned } = res.data
      alert(orphaned.length
        ? `已刷新 ${updated} 个账号。这些账号在该令牌下找不到了：${orphaned.join('、')}`
        : `已刷新 ${updated} 个账号的主页凭证`)
    },
  })

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{c.label}</span>
        <Badge variant={STATUS_VARIANTS[c.status]}>{STATUS_LABELS[c.status]}</Badge>
        <span className="text-xs text-muted-foreground">
          {c.tokenType === 'SYSTEM_USER' ? '系统用户令牌' : '用户令牌'} · {describeExpiry(c.expiresAt)}
        </span>
        <span className="ml-auto text-sm text-muted-foreground">已接入 {c.accountCount} 个账号</span>
      </div>

      {c.lastError && (
        <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="min-w-0 break-words">{c.lastError}</span>
        </p>
      )}

      {c.pendingTargets.length > 0 && (
        <button
          type="button"
          onClick={onLink}
          className="flex w-full items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-left text-xs hover:bg-emerald-500/20"
        >
          <span className="flex-1 min-w-0 truncate">
            发现 {c.pendingTargets.length} 个还没接入的目标：
            {c.pendingTargets.slice(0, 3).map((t) => t.username).join('、')}
            {c.pendingTargets.length > 3 && ' 等'}
          </span>
          <span className="shrink-0 font-medium">去接入</span>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onLink}>接入账号</Button>
        <Button variant="outline" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
          刷新主页凭证
        </Button>
        <Button variant="outline" size="sm" onClick={onRotate}>更换令牌</Button>
        <Button variant="ghost" size="sm" className="text-destructive ml-auto" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
