import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Plus, RefreshCw, KeyRound, Trash2, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { WORKSPACE_ROLE_LABELS } from '@/lib/workspace-labels'
import type { User, UserRole, Workspace, WorkspaceRole } from '@/types'

/** 建号时怎么处理空间归属，和后端 CreateUserDto.workspaceMode 对应 */
type WorkspaceMode = 'join' | 'create' | 'none'
const WS_ROLES: WorkspaceRole[] = ['manager', 'member', 'viewer']

export default function UsersPage() {
  const qc = useQueryClient()
  const { me } = useMe()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)
  const [removing, setRemoving] = useState<User | null>(null)

  const { data: users = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users').then((r) => r.data),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      setRemoving(null)
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const toggleActive = useMutation({
    mutationFn: (u: User) => api.patch(`/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  /** 表格行和窄屏卡片共用 */
  function rowActions(u: User) {
    return (
      <>
        <IconAction title="编辑" onClick={() => { setEditing(u); setFormOpen(true) }}>
          <Pencil className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction title="重置密码" onClick={() => setResetting(u)}>
          <KeyRound className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction
          title={u.id === me?.id ? '不能删除自己' : '删除'}
          disabled={u.id === me?.id}
          onClick={() => setRemoving(u)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </IconAction>
      </>
    )
  }

  function activeToggle(u: User) {
    return (
      <button
        className={`text-xs ${u.isActive ? 'text-emerald-600' : 'text-muted-foreground'} hover:underline disabled:no-underline`}
        disabled={u.id === me?.id || toggleActive.isPending}
        title={u.id === me?.id ? '不能停用自己' : u.isActive ? '点击停用' : '点击启用'}
        onClick={() => toggleActive.mutate(u)}
      >
        {u.isActive ? '已启用' : '已停用'}
      </button>
    )
  }

  function roleBadge(u: User) {
    return (
      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
        {u.role === 'admin' ? '管理员' : '普通用户'}
      </Badge>
    )
  }

  function workspaceCell(u: User) {
    // 平台管理员在任何空间都是 manager，列出他那几行成员关系反而会让人以为只有这几个
    if (u.role === 'admin') return <span className="text-xs text-muted-foreground">全部空间</span>

    const list = u.workspaces ?? []
    if (!list.length) return <span className="text-xs text-muted-foreground">未分配</span>

    return (
      <div className="flex flex-wrap items-center gap-1">
        {list.slice(0, 2).map((w) => (
          <Badge key={w.id} variant="outline" className="text-xs font-normal" title={WORKSPACE_ROLE_LABELS[w.role]}>
            {w.name}
          </Badge>
        ))}
        {list.length > 2 && (
          <span className="text-xs text-muted-foreground" title={list.map((w) => w.name).join('、')}>
            +{list.length - 2}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">用户管理</h1>
          <p className="text-muted-foreground text-sm mt-1">共 {users.length} 个用户</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">新建用户</span>
          </Button>
        </div>
      </div>

      {(removeMutation.isError || toggleActive.isError) && (
        <p className="text-sm text-destructive">{errorText(removeMutation.error ?? toggleActive.error)}</p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
        <div className="space-y-2 md:hidden">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl border bg-background p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">
                    {u.displayName}
                    {u.id === me?.id && <span className="ml-1.5 text-xs text-muted-foreground">（我）</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email} · @{u.username}
                  </p>
                </div>
                {roleBadge(u)}
              </div>
              {workspaceCell(u)}
              <div className="flex items-center justify-between gap-2 border-t pt-2">
                <span className="text-xs text-muted-foreground">
                  {activeToggle(u)} · {u.lastLoginAt ? formatTime(u.lastLoginAt) : '从未登录'}
                </span>
                <div className="flex shrink-0 gap-1">{rowActions(u)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">用户</th>
                <th className="w-28 px-3 py-2.5 text-left font-medium">角色</th>
                <th className="w-56 px-3 py-2.5 text-left font-medium">工作空间</th>
                <th className="w-24 px-3 py-2.5 text-left font-medium">状态</th>
                <th className="w-40 px-3 py-2.5 text-left font-medium">最近登录</th>
                <th className="w-40 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="group hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {u.displayName}
                      {u.id === me?.id && <span className="ml-1.5 text-xs text-muted-foreground">（我）</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {u.email} · @{u.username}
                    </p>
                  </td>
                  <td className="px-3 py-2">{roleBadge(u)}</td>
                  <td className="px-3 py-2">{workspaceCell(u)}</td>
                  <td className="px-3 py-2">{activeToggle(u)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                    {u.lastLoginAt ? formatTime(u.lastLoginAt) : '从未登录'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {rowActions(u)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <UserFormDialog open={formOpen} user={editing} onClose={() => setFormOpen(false)} />
      <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />

      {removing && (
        <Dialog open onOpenChange={(o) => !o && setRemoving(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>删除用户</DialogTitle>
            </DialogHeader>
            <p className="text-sm">
              删除「{removing.displayName}」后该账号立即失效，其创建的作品会保留。确定删除？
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoving(null)} disabled={removeMutation.isPending}>取消</Button>
              <Button variant="destructive" onClick={() => removeMutation.mutate(removing.id)} disabled={removeMutation.isPending}>
                {removeMutation.isPending ? '删除中…' : '确定删除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function UserFormDialog({ open, user, onClose }: { open: boolean; user: User | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [wsMode, setWsMode] = useState<WorkspaceMode>('none')
  const [wsId, setWsId] = useState('')
  const [wsRole, setWsRole] = useState<WorkspaceRole>('member')
  const [wsName, setWsName] = useState('')

  // 和 useWorkspace 共用同一个 queryKey，缓存跟着复用
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<Workspace[]>('/workspaces').then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled: open && !user,
  })

  useEffect(() => {
    if (!open) return
    setUsername(user?.username ?? '')
    setEmail(user?.email ?? '')
    setDisplayName(user?.displayName ?? '')
    setRole(user?.role ?? 'user')
    setPassword('')
    setWsMode('none')
    setWsId('')
    setWsRole('member')
    setWsName('')
  }, [open, user])

  /** 切到「新建空间」时拿显示名垫一下，之后随便改 */
  function pickWsMode(mode: WorkspaceMode) {
    setWsMode(mode)
    if (mode === 'create' && !wsName.trim()) setWsName(displayName.trim())
  }

  const mutation = useMutation({
    mutationFn: (): Promise<unknown> =>
      user
        ? api.patch(`/users/${user.id}`, { displayName, role, email: email.trim() })
        : api.post('/users', {
          username, password, displayName, role, email: email.trim(),
          workspaceMode: wsMode,
          ...(wsMode === 'join' ? { workspaceId: wsId, workspaceRole: wsRole } : {}),
          ...(wsMode === 'create' ? { workspaceName: wsName.trim() } : {}),
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      // 新建空间会让空间列表变长，切换器得跟着刷新
      if (wsMode === 'create') qc.invalidateQueries({ queryKey: ['workspaces'] })
      onClose()
    },
  })

  // 空间名没有唯一约束，重名不拦，但得提醒——切换器里两个同名空间根本分不出来
  const duplicateName = wsMode === 'create'
    && workspaces.some((w) => w.name.trim() === wsName.trim())

  const wsOk = wsMode === 'none'
    || (wsMode === 'join' && wsId !== '')
    || (wsMode === 'create' && wsName.trim().length > 0)

  // 邮箱是唯一的登录凭据，留空会被后端打回，这里先把提交按钮压住
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valid = emailOk && (user
    ? displayName.trim().length > 0
    : username.trim().length >= 3 && displayName.trim().length > 0 && password.length >= 8 && wsOk)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{user ? '编辑用户' : '新建用户'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>用户名</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={Boolean(user)}
              placeholder="字母、数字、下划线"
              autoComplete="off"
            />
            {user && <p className="text-xs text-muted-foreground">用户名创建后不能修改</p>}
          </div>
          <div className="space-y-1.5">
            <Label>邮箱</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="用于登录"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>显示名称</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          {!user && (
            <div className="space-y-1.5">
              <Label>初始密码</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">至少 8 位</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>角色</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">普通用户</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === 'admin' ? '可以审核作品、管理用户' : '可以创建作品并提交审核，不能自己审核'}
            </p>
          </div>

          {!user && (
            <div className="space-y-1.5">
              <Label>工作空间</Label>
              <Select value={wsMode} onValueChange={(v) => pickWsMode(v as WorkspaceMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="join">加入现有空间</SelectItem>
                  <SelectItem value="create">新建空间</SelectItem>
                  <SelectItem value="none">暂不分配</SelectItem>
                </SelectContent>
              </Select>

              {wsMode === 'join' && (
                <div className="space-y-1.5 pt-1">
                  <Select value={wsId} onValueChange={setWsId}>
                    <SelectTrigger><SelectValue placeholder="选择空间" /></SelectTrigger>
                    <SelectContent>
                      {workspaces.map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={wsRole} onValueChange={(v) => setWsRole(v as WorkspaceRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WS_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{WORKSPACE_ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {wsMode === 'create' && (
                <div className="space-y-1.5 pt-1">
                  <Input value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="空间名称" />
                  <p className="text-xs text-muted-foreground">
                    {displayName.trim() || '该用户'} 将成为这个空间的管理员
                  </p>
                  {duplicateName && (
                    <p className="text-xs text-amber-600">
                      已经有一个叫「{wsName.trim()}」的空间了，切换器里会分不清
                    </p>
                  )}
                </div>
              )}

              {wsMode === 'none' && (
                <p className="text-xs text-muted-foreground">
                  该用户登录后看不到任何数据，需要之后在工作空间里再分配
                </p>
              )}
            </div>
          )}

          {mutation.isError && <p className="text-sm text-destructive">{errorText(mutation.error)}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>取消</Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
            {mutation.isPending ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (user) { setPassword(''); setDone(false) }
  }, [user])

  const mutation = useMutation({
    mutationFn: () => api.patch(`/users/${user!.id}/password`, { password }),
    onSuccess: () => setDone(true),
  })

  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>重置密码</DialogTitle>
        </DialogHeader>

        {done ? (
          <p className="text-sm text-emerald-600">
            已重置「{user?.displayName}」的密码，请把新密码通过安全渠道告知本人。
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{user?.displayName} 的新密码</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">至少 8 位</p>
            </div>
            {mutation.isError && <p className="text-sm text-destructive">{errorText(mutation.error)}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>{done ? '关闭' : '取消'}</Button>
          {!done && (
            <Button onClick={() => mutation.mutate()} disabled={password.length < 8 || mutation.isPending}>
              {mutation.isPending ? '提交中…' : '确认重置'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function IconAction({ title, disabled, onClick, children }: {
  title: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="h-7 w-7 rounded-md border flex items-center justify-center transition-colors enabled:hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
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

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
