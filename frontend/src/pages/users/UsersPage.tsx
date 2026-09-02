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
import type { User, UserRole } from '@/types'

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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-muted-foreground text-sm mt-1">共 {users.length} 个用户</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" />
            新建用户
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
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">用户</th>
                <th className="w-28 px-3 py-2.5 text-left font-medium">角色</th>
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
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                      {u.role === 'admin' ? '管理员' : '普通用户'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className={`text-xs ${u.isActive ? 'text-emerald-600' : 'text-muted-foreground'} hover:underline disabled:no-underline`}
                      disabled={u.id === me?.id || toggleActive.isPending}
                      title={u.id === me?.id ? '不能停用自己' : u.isActive ? '点击停用' : '点击启用'}
                      onClick={() => toggleActive.mutate(u)}
                    >
                      {u.isActive ? '已启用' : '已停用'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                    {u.lastLoginAt ? formatTime(u.lastLoginAt) : '从未登录'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')

  useEffect(() => {
    if (!open) return
    setUsername(user?.username ?? '')
    setDisplayName(user?.displayName ?? '')
    setRole(user?.role ?? 'user')
    setPassword('')
  }, [open, user])

  const mutation = useMutation({
    mutationFn: (): Promise<unknown> =>
      user
        ? api.patch(`/users/${user.id}`, { displayName, role })
        : api.post('/users', { username, password, displayName, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })

  const valid = user
    ? displayName.trim().length > 0
    : username.trim().length >= 3 && displayName.trim().length > 0 && password.length >= 8

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
