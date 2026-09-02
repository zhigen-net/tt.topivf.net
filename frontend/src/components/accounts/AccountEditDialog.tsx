import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import type { Account, AccountStatus, Proxy } from '@/types'

const NONE = '__none__'

const statusOptions: { value: AccountStatus; label: string }[] = [
  { value: 'active', label: '正常' },
  { value: 'inactive', label: '停用' },
  { value: 'warming', label: '养号' },
  { value: 'banned', label: '封禁' },
]

interface Props {
  account: Account | null
  onClose: () => void
}

export function AccountEditDialog({ account, onClose }: Props) {
  const qc = useQueryClient()
  const open = Boolean(account)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatar, setAvatar] = useState('')
  const [status, setStatus] = useState<AccountStatus>('inactive')
  const [proxyId, setProxyId] = useState<string>(NONE)
  const [cookies, setCookies] = useState('')

  useEffect(() => {
    if (!account) return
    setUsername(account.username)
    setDisplayName(account.displayName)
    setAvatar(account.avatar ?? '')
    setStatus(account.status)
    setProxyId(account.proxyId ?? NONE)
    setCookies('')
  }, [account])

  const { data: proxies } = useQuery({
    queryKey: ['proxies'],
    queryFn: () => api.get<Proxy[]>('/proxies').then((r) => r.data),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: () => api.patch(`/accounts/${account!.id}`, {
      username: username.trim(),
      displayName: displayName.trim(),
      avatar: avatar.trim() || undefined,
      status,
      proxyId: proxyId === NONE ? null : proxyId,
      // 留空表示不动现有凭证；后端把 sessionData 整体覆盖，传空对象会把 cookie 清掉
      ...(cookies.trim() ? { sessionData: { cookies: cookies.trim() } } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      onClose()
    },
  })

  const isFacebook = account?.platform === 'facebook'
  const canSubmit = username.trim() && displayName.trim() && !mutation.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑账号</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>用户名</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>显示名称</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>头像地址 <span className="text-muted-foreground">（选填）</span></Label>
            <Input placeholder="https://…" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>状态</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AccountStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>代理</Label>
              <Select value={proxyId} onValueChange={setProxyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>不使用代理</SelectItem>
                  {(proxies ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label ?? `${p.host}:${p.port}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isFacebook && (
            <div className="space-y-1.5">
              <Label>更新登录凭证 <span className="text-muted-foreground">（选填）</span></Label>
              <Textarea
                placeholder="粘贴新的 Cookie，留空则保持现有凭证不变…"
                rows={3}
                value={cookies}
                onChange={(e) => setCookies(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          )}
          {isFacebook && (
            <p className="text-xs text-muted-foreground">
              Facebook 主页令牌需要重新绑定主页才能更新，这里改不了。
            </p>
          )}

          {mutation.isError && <p className="text-sm text-destructive">保存失败，请重试。</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>取消</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending ? '保存中…' : '保存修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
