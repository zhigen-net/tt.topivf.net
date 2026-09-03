import { Building2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWorkspace } from '@/lib/workspace'
import { WORKSPACE_ROLE_LABELS } from '@/lib/workspace-labels'

export function WorkspaceSwitcher() {
  const { workspace, workspaces, switchTo, isLoading } = useWorkspace()

  if (isLoading) return <div className="h-9 animate-pulse rounded-md bg-muted" />
  if (!workspace) {
    return (
      <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        还没有加入任何工作空间
      </div>
    )
  }

  return (
    <Select value={workspace.id} onValueChange={switchTo}>
      <SelectTrigger className="h-9">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            <span className="truncate">{w.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">{WORKSPACE_ROLE_LABELS[w.role]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
