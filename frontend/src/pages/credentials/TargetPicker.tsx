import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlatformBadge } from '@/components/PlatformBadge'
import type { CredentialTarget, DiscoveredTarget } from '@/types'

/** 选中集合用 `平台:外部id` 做键——一个主页会同时产出主页本身和它关联的 IG 账号 */
const keyOf = (t: CredentialTarget) => `${t.platform}:${t.externalId}`

export function useTargetSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  return {
    count: selected.size,
    has: (t: CredentialTarget) => selected.has(keyOf(t)),
    toggle(t: CredentialTarget) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (!next.delete(keyOf(t))) next.add(keyOf(t))
        return next
      })
    },
    selectAll(targets: DiscoveredTarget[]) {
      setSelected(new Set(targets.filter((t) => !t.linkedAccountId).map(keyOf)))
    },
    reset: () => setSelected(new Set()),
    chosen: (targets: DiscoveredTarget[]) =>
      targets
        .filter((t) => !t.linkedAccountId && selected.has(keyOf(t)))
        .map(({ platform, externalId }) => ({ platform, externalId })),
  }
}

export type TargetSelection = ReturnType<typeof useTargetSelection>

export function TargetPicker({ targets, selection }: {
  targets: DiscoveredTarget[]
  selection: TargetSelection
}) {
  const available = targets.filter((t) => !t.linkedAccountId)
  const linked = targets.filter((t) => t.linkedAccountId)

  if (!targets.length) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        这条令牌名下没有可接入的主页。请确认已在商务管理平台把主页分配给该系统用户，并给了发布权限。
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">
          {available.length ? `${available.length} 个可接入` : '名下账号都已接入'}
          {linked.length > 0 && `，${linked.length} 个已接入`}
        </p>
        {available.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() =>
            selection.count === available.length ? selection.reset() : selection.selectAll(targets)
          }>
            {selection.count === available.length ? '取消全选' : '全选'}
          </Button>
        )}
      </div>

      <div className="max-h-80 space-y-1.5 overflow-y-auto">
        {available.map((t) => (
          <TargetRow key={keyOf(t)} target={t} checked={selection.has(t)} onToggle={() => selection.toggle(t)} />
        ))}
        {linked.map((t) => (
          <TargetRow key={keyOf(t)} target={t} linked />
        ))}
      </div>
    </div>
  )
}

function TargetRow({ target, checked, linked, onToggle }: {
  target: DiscoveredTarget
  checked?: boolean
  linked?: boolean
  onToggle?: () => void
}) {
  const label = target.platform === 'instagram' ? `@${target.username}` : target.username

  return (
    <button
      type="button"
      disabled={linked}
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
        linked ? 'opacity-50' : checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
      }`}
    >
      <img src={target.avatar ?? ''} alt="" className="h-8 w-8 shrink-0 rounded-full bg-muted object-cover" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <PlatformBadge platform={target.platform} className="shrink-0" />
          <span className="truncate">{label}</span>
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {linked ? '已接入' : `${target.followers} 粉丝`}
        </p>
      </div>
      {!linked && (
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
        }`}>
          {checked && <Check className="h-3 w-3" />}
        </span>
      )}
    </button>
  )
}
