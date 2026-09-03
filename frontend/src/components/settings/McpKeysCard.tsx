import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Check, Copy, Plus, Trash2, Ban } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PlatformBadge } from '@/components/PlatformBadge'
import { api } from '@/lib/api'
import { useMe } from '@/lib/auth'
import { useWorkspace } from '@/lib/workspace'
import { WORKSPACE_ROLE_LABELS } from '@/lib/workspace-labels'
import { MCP_SCOPES } from '@/types'
import type { Account, ApiKey, McpScope, PaginatedResponse } from '@/types'

const SCOPE_LABELS: Record<McpScope, { label: string; hint: string }> = {
  'contents:read': { label: '查看作品', hint: '读取作品库、审核状态与发布情况' },
  'contents:write': { label: '创建 / 修改作品', hint: '新建草稿、改文案、提交审核' },
  'contents:review': { label: '审核作品', hint: 'AI 可以自行通过或驳回，相当于绕过人工审核' },
  'accounts:read': { label: '查看社交账号', hint: '只返回昵称与粉丝数，不含任何登录凭证' },
  'tasks:read': { label: '查看发布任务', hint: '读取排期与发布结果' },
  'tasks:publish': { label: '发布作品', hint: 'AI 可以把已过审的作品真的发出去' },
  'analytics:read': { label: '查看数据趋势', hint: '读取粉丝、互动的历史快照' },
}

const ENDPOINT = `${window.location.origin}/api/v1/mcp`

export function McpKeysCard() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [issued, setIssued] = useState<{ apiKey: ApiKey; token: string } | null>(null)
  const [removing, setRemoving] = useState<ApiKey | null>(null)

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<ApiKey[]>('/api-keys').then((r) => r.data),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api.post(`/api-keys/${id}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => {
      setRemoving(null)
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">MCP 接入</CardTitle>
            <CardDescription>
              给 Claude 等 AI 客户端签发密钥，让它直接查账号、建作品、审核和发布
            </CardDescription>
          </div>
          <Button size="sm" className="shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">新建密钥</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">服务地址</p>
          <CopyLine value={ENDPOINT} />
        </div>

        {isLoading ? (
          <div className="h-14 rounded-lg border bg-muted/30 animate-pulse" />
        ) : keys.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">还没有密钥</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{k.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">sh_{k.prefix}…</p>
                  </div>
                  {keyStatus(k)}
                </div>

                <p className="text-xs text-muted-foreground">
                  签发人 {k.user?.displayName ?? '—'} · 账号 {k.accountIds ? `${k.accountIds.length} 个` : '不限'}
                  {' · '}权限 {k.scopes.length} 项
                  {' · '}{k.lastUsedAt ? `最近使用 ${formatTime(k.lastUsedAt)}` : '从未使用'}
                </p>

                <div className="flex flex-wrap gap-1">
                  {k.scopes.map((s) => (
                    <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {SCOPE_LABELS[s]?.label ?? s}
                    </span>
                  ))}
                </div>

                <div className="flex justify-end gap-2 border-t pt-2">
                  {!k.revokedAt && (
                    <Button variant="outline" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(k.id)}>
                      <Ban className="h-3.5 w-3.5" />
                      吊销
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setRemoving(k)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CreateKeyDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onIssued={(r) => { setCreateOpen(false); setIssued(r) }}
      />

      <IssuedTokenDialog issued={issued} onClose={() => setIssued(null)} />

      {removing && (
        <Dialog open onOpenChange={(o) => !o && setRemoving(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>删除密钥</DialogTitle></DialogHeader>
            <p className="text-sm">删除「{removing.name}」后，正在使用它的客户端会立即失去访问权限。确定删除？</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoving(null)} disabled={remove.isPending}>取消</Button>
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

function CreateKeyDrawer({ open, onClose, onIssued }: {
  open: boolean
  onClose: () => void
  onIssued: (r: { apiKey: ApiKey; token: string }) => void
}) {
  const qc = useQueryClient()
  const { me } = useMe()
  const { workspace, role } = useWorkspace()
  const [name, setName] = useState('')
  const [allAccounts, setAllAccounts] = useState(true)
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [scopes, setScopes] = useState<McpScope[]>(['contents:read', 'accounts:read', 'tasks:read'])
  const [expiresAt, setExpiresAt] = useState('')
  const [search, setSearch] = useState('')

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', 'all'],
    queryFn: () => api.get<PaginatedResponse<Account>>('/accounts', { params: { limit: 100 } })
      .then((r) => r.data.data),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setName('')
    setAllAccounts(true)
    setAccountIds([])
    setScopes(['contents:read', 'accounts:read', 'tasks:read'])
    setExpiresAt('')
    setSearch('')
  }, [open])

  const visibleAccounts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter((a) => (
      a.username.toLowerCase().includes(q) || a.displayName.toLowerCase().includes(q)
    ))
  }, [accounts, search])

  const mutation = useMutation({
    mutationFn: () => api.post<{ apiKey: ApiKey; token: string }>('/api-keys', {
      name: name.trim(),
      scopes,
      accountIds: allAccounts ? null : accountIds,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    }).then((r) => r.data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      onIssued(r)
    },
  })

  const valid = name.trim().length > 0 && scopes.length > 0 && (allAccounts || accountIds.length > 0)

  function toggleScope(s: McpScope) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  function toggleAccount(id: string) {
    setAccountIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>新建 MCP 密钥</DrawerTitle>
          <p className="mt-1 text-sm text-muted-foreground">一把密钥 = 空间 + 账号范围 + 权限范围</p>
        </DrawerHeader>

        <DrawerBody>
          <Section step={1} title="基本信息" hint="密钥固定绑当前空间和你自己，AI 的操作都会记在你名下">
            <div className="space-y-1.5">
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：Claude 桌面端" />
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              所属空间 <span className="text-foreground">{workspace?.name ?? '—'}</span>
              {' · '}身份 <span className="text-foreground">{me?.displayName ?? '—'}</span>
              {role && `（${WORKSPACE_ROLE_LABELS[role]}）`}
            </div>
            <div className="space-y-1.5">
              <Label>过期时间（可选）</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </Section>

          <Section step={2} title="账号范围" hint="限定这把密钥能碰哪些社交账号">
            <div className="flex gap-2">
              <ChoiceButton active={allAccounts} onClick={() => setAllAccounts(true)}>全部账号</ChoiceButton>
              <ChoiceButton active={!allAccounts} onClick={() => setAllAccounts(false)}>
                指定账号{accountIds.length > 0 && `（${accountIds.length}）`}
              </ChoiceButton>
            </div>

            {!allAccounts && (
              <div className="space-y-2">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索账号" />
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
                  {visibleAccounts.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">没有匹配的账号</p>
                  )}
                  {visibleAccounts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => toggleAccount(a.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
                    >
                      <CheckBox checked={accountIds.includes(a.id)} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {a.displayName}
                        <span className="ml-1.5 text-xs text-muted-foreground">@{a.username}</span>
                      </span>
                      <PlatformBadge platform={a.platform} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section step={3} title="权限范围" hint="只勾必要的。审核和发布是会产生外部影响的操作">
            <div className="space-y-1">
              {MCP_SCOPES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleScope(s)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
                >
                  <CheckBox checked={scopes.includes(s)} />
                  <span className="min-w-0">
                    <span className="block text-sm">{SCOPE_LABELS[s].label}</span>
                    <span className="block text-xs text-muted-foreground">{SCOPE_LABELS[s].hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {(scopes.includes('contents:review') || scopes.includes('tasks:publish')) && (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                已授予审核或发布权限：AI 可以不经人工确认就把内容发到真实账号上。
              </p>
            )}
          </Section>

          {mutation.isError && <p className="text-sm text-destructive">{errorText(mutation.error)}</p>}
        </DrawerBody>

        <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>取消</Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
            {mutation.isPending ? '创建中…' : '创建密钥'}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function IssuedTokenDialog({ issued, onClose }: {
  issued: { apiKey: ApiKey; token: string } | null
  onClose: () => void
}) {
  const cliCommand = issued
    ? `claude mcp add --transport http socialhub ${ENDPOINT} --header "Authorization: Bearer ${issued.token}"`
    : ''

  return (
    <Dialog open={Boolean(issued)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>密钥已创建</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            这是唯一一次能看到完整密钥的机会，关掉后就取不回来了。
          </p>

          <div className="space-y-1.5">
            <Label>密钥</Label>
            <CopyLine value={issued?.token ?? ''} />
          </div>

          <div className="space-y-1.5">
            <Label>接入 Claude Code</Label>
            <CopyLine value={cliCommand} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>我已保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CopyLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs">{value}</code>
      <button onClick={copy} title="复制" className="shrink-0 rounded p-1 hover:bg-accent">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

function Section({ step, title, hint, children }: {
  step: number
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          {step}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="-mt-2 pl-7 text-xs text-muted-foreground">{hint}</p>
      <div className="space-y-3 pl-7">{children}</div>
    </div>
  )
}

function ChoiceButton({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
        active ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent'
      }`}
    >
      {children}
    </button>
  )
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
        checked ? 'border-primary bg-primary text-primary-foreground' : ''
      }`}
    >
      {checked && <Check className="h-3 w-3" />}
    </span>
  )
}

function keyStatus(k: ApiKey) {
  if (k.revokedAt) return <Badge variant="destructive" className="shrink-0">已吊销</Badge>
  if (k.expiresAt && new Date(k.expiresAt).getTime() < Date.now()) {
    return <Badge variant="secondary" className="shrink-0">已过期</Badge>
  }
  return <Badge variant="success" className="shrink-0">生效中</Badge>
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
