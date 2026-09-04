import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Building2, Plus, Trash2, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { useWorkspace } from '@/lib/workspace'
import { WORKSPACE_ROLE_LABELS } from '@/lib/workspace-labels'
import type { User, Workspace, WorkspaceMember, WorkspaceRole } from '@/types'

const ROLE_HINTS: Record<WorkspaceRole, string> = {
  manager: '可管理成员、改空间设置，并删除空间内的任何数据',
  member: '可创建、审核、发布作品，可加账号和代理；只能删自己空间里的草稿',
  viewer: '只能查看，不能做任何修改',
}

export default function WorkspacePage() {
  const { isAdmin } = useMe()
  const { workspace, isManager } = useWorkspace()

  // 加载中和「没有空间」都由外层 WorkspaceLayout 处理了
  if (!workspace) return null

  return (
    <div className="space-y-4">
      {isManager && <RenameCard workspace={workspace} />}
      <MembersCard workspace={workspace} canManage={isManager} />
      {isAdmin && <AllWorkspacesCard currentId={workspace.id} />}
    </div>
  )
}

function RenameCard({ workspace }: { workspace: Workspace }) {
  const qc = useQueryClient()
  const [name, setName] = useState(workspace.name)

  useEffect(() => setName(workspace.name), [workspace.name])

  const mutation = useMutation({
    mutationFn: () => api.patch(`/workspaces/${workspace.id}`, { name: name.trim() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  })

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">空间名称</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1 space-y-1.5">
          <Label>名称</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!name.trim() || name.trim() === workspace.name || mutation.isPending}
        >
          {mutation.isPending ? '保存中…' : '保存'}
        </Button>
        {mutation.isError && <p className="w-full text-sm text-destructive">{errorText(mutation.error)}</p>}
      </CardContent>
    </Card>
  )
}

function MembersCard({ workspace, canManage }: { workspace: Workspace; canManage: boolean }) {
  const qc = useQueryClient()
  const { me } = useMe()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['workspace-members', workspace.id],
    queryFn: () => api.get<WorkspaceMember[]>(`/workspaces/${workspace.id}/members`).then((r) => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['workspace-members', workspace.id] })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: WorkspaceRole }) =>
      api.patch(`/workspaces/${workspace.id}/members/${id}`, { role }),
    onSuccess: () => {
      invalidate()
      // 改的可能是自己，角色变了侧边栏和按钮都要跟着变
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })

  const removeMember = useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspace.id}/members/${id}`),
    onSuccess: () => {
      setRemoving(null)
      invalidate()
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">成员（{members.length}）</CardTitle>
        {canManage && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">添加成员</span>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
        {members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {m.user?.displayName ?? m.userId}
                {m.userId === me?.id && <span className="ml-1.5 text-xs text-muted-foreground">（我）</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">@{m.user?.username}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canManage ? (
                <Select
                  value={m.role}
                  onValueChange={(role) => changeRole.mutate({ id: m.id, role: role as WorkspaceRole })}
                >
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(WORKSPACE_ROLE_LABELS) as WorkspaceRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{WORKSPACE_ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{WORKSPACE_ROLE_LABELS[m.role]}</Badge>
              )}
              {canManage && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRemoving(m)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {(changeRole.isError || removeMember.isError) && (
          <p className="text-sm text-destructive">{errorText(changeRole.error ?? removeMember.error)}</p>
        )}
      </CardContent>

      {adding && <AddMemberDialog workspace={workspace} onClose={() => setAdding(false)} onAdded={invalidate} />}

      {removing && (
        <Dialog open onOpenChange={(o) => !o && setRemoving(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>移出空间</DialogTitle></DialogHeader>
            <p className="text-sm">
              把「{removing.user?.displayName}」移出「{workspace.name}」后，他签发的 MCP 密钥会立刻失效。确定移出？
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoving(null)}>取消</Button>
              <Button
                variant="destructive"
                onClick={() => removeMember.mutate(removing.id)}
                disabled={removeMember.isPending}
              >
                {removeMember.isPending ? '处理中…' : '确定移出'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

function AddMemberDialog({ workspace, onClose, onAdded }: {
  workspace: Workspace
  onClose: () => void
  onAdded: () => void
}) {
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Pick<User, 'id' | 'username' | 'displayName'> | null>(null)
  const [role, setRole] = useState<WorkspaceRole>('member')

  const { data: candidates = [] } = useQuery({
    queryKey: ['workspace-candidates', workspace.id, search],
    queryFn: () => api
      .get<Pick<User, 'id' | 'username' | 'displayName'>[]>(`/workspaces/${workspace.id}/candidates`, {
        params: { search },
      })
      .then((r) => r.data),
    enabled: search.trim().length > 0,
  })

  const mutation = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspace.id}/members`, { userId: picked!.id, role }),
    onSuccess: () => { onAdded(); onClose() },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>添加成员</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>搜索用户</Label>
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPicked(null) }}
              placeholder="用户名或显示名称"
              autoComplete="off"
            />
          </div>

          {search.trim() && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
              {candidates.length === 0 && <p className="p-2 text-xs text-muted-foreground">没有匹配的用户</p>}
              {candidates.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setPicked(u)}
                  className={`flex w-full flex-col items-start rounded px-2 py-1.5 text-left text-sm transition-colors ${
                    picked?.id === u.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                  }`}
                >
                  <span>{u.displayName}</span>
                  <span className="text-xs opacity-70">@{u.username}</span>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>空间角色</Label>
            <Select value={role} onValueChange={(v) => setRole(v as WorkspaceRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(WORKSPACE_ROLE_LABELS) as WorkspaceRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{WORKSPACE_ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_HINTS[role]}</p>
          </div>

          {mutation.isError && <p className="text-sm text-destructive">{errorText(mutation.error)}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => mutation.mutate()} disabled={!picked || mutation.isPending}>
            {mutation.isPending ? '添加中…' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AllWorkspacesCard({ currentId }: { currentId: string }) {
  const qc = useQueryClient()
  const { workspaces, switchTo } = useWorkspace()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [removing, setRemoving] = useState<Workspace | null>(null)

  const create = useMutation({
    mutationFn: () => api.post('/workspaces', { name: name.trim() }),
    onSuccess: () => {
      setCreating(false)
      setName('')
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${id}`),
    onSuccess: () => {
      setRemoving(null)
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">全部工作空间</CardTitle>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">新建空间</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {workspaces.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
            <div className="flex min-w-0 items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">{w.name}</span>
              {w.id === currentId && <Badge variant="secondary" className="shrink-0">当前</Badge>}
            </div>
            <div className="flex shrink-0 gap-1">
              {w.id !== currentId && (
                <Button variant="outline" size="sm" onClick={() => switchTo(w.id)}>切换</Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRemoving(w)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {remove.isError && <p className="text-sm text-destructive">{errorText(remove.error)}</p>}
      </CardContent>

      {creating && (
        <Dialog open onOpenChange={(o) => !o && setCreating(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>新建工作空间</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>空间名称</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
              </div>
              <p className="text-xs text-muted-foreground">建好后你自动成为该空间的管理员。</p>
              {create.isError && <p className="text-sm text-destructive">{errorText(create.error)}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreating(false)}>取消</Button>
              <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
                {create.isPending ? '创建中…' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {removing && (
        <Dialog open onOpenChange={(o) => !o && setRemoving(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>删除工作空间</DialogTitle></DialogHeader>
            <p className="text-sm">
              删除「{removing.name}」。空间下还有账号、作品等数据时会被拒绝，需要先清空。
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoving(null)}>取消</Button>
              <Button variant="destructive" onClick={() => remove.mutate(removing.id)} disabled={remove.isPending}>
                {remove.isPending ? '删除中…' : '确定删除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

function errorText(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string | string[] } | undefined)?.message
    if (Array.isArray(msg)) return msg.join('；')
    if (msg) return msg
  }
  return '操作失败，请重试。'
}
