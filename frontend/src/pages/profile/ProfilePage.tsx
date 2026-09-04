import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChangePasswordDialog } from '@/components/users/ChangePasswordDialog'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { useWorkspace } from '@/lib/workspace'
import { WORKSPACE_ROLE_LABELS } from '@/lib/workspace-labels'

export default function ProfilePage() {
  const qc = useQueryClient()
  const { me, isAdmin } = useMe()
  const { workspaces } = useWorkspace()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [passwordOpen, setPasswordOpen] = useState(false)

  useEffect(() => {
    if (!me) return
    setDisplayName(me.displayName)
    setEmail(me.email ?? '')
  }, [me])

  const save = useMutation({
    mutationFn: () => api.patch('/users/me', { displayName: displayName.trim(), email: email.trim() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })

  const changed = displayName.trim() !== me?.displayName || email.trim() !== (me?.email ?? '')
  const dirty = Boolean(me) && changed && displayName.trim().length > 0

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">个人资料</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理你的登录信息与显示名称</p>
      </div>

      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本资料</CardTitle>
            <CardDescription>用户名由管理员分配，不能自行修改</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>用户名</Label>
              <Input value={me?.username ?? ''} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="选填"
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">填了之后，登录时用邮箱代替用户名也可以</p>
            </div>
            <div className="space-y-1.5">
              <Label>显示名称</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            {save.isError && <p className="text-sm text-destructive">{errorText(save.error)}</p>}
            <div className="flex items-center gap-3">
              <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                {save.isPending ? '保存中…' : '保存'}
              </Button>
              {save.isSuccess && !dirty && <span className="text-sm text-emerald-600">已保存</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">登录密码</CardTitle>
            <CardDescription>定期更换，避免与其它系统共用</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setPasswordOpen(true)}>修改密码</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">权限</CardTitle>
            <CardDescription>系统角色由管理员分配，空间角色由空间管理员分配</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">系统角色</span>
              <Badge variant={isAdmin ? 'default' : 'secondary'}>{isAdmin ? '管理员' : '普通用户'}</Badge>
            </div>
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm">所属工作空间</p>
              {workspaces.length === 0 ? (
                <p className="text-xs text-muted-foreground">还没有加入任何工作空间</p>
              ) : (
                workspaces.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-muted-foreground">{w.name}</span>
                    <Badge variant="secondary" className="shrink-0">{WORKSPACE_ROLE_LABELS[w.role]}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}

function errorText(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string | string[] } | undefined)?.message
    if (Array.isArray(msg)) return msg.join('；')
    if (msg) return msg
  }
  return '保存失败，请重试。'
}
