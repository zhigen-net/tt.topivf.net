import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { describeToken, type LinkablePagesResult } from './FacebookLinkDialog'
import type { Account, AccountStatus, Proxy } from '@/types'

const NONE = '__none__'

const statusOptions: { value: AccountStatus; label: string }[] = [
  { value: 'active', label: '正常' },
  { value: 'inactive', label: '停用' },
  { value: 'warming', label: '养号' },
  { value: 'banned', label: '封禁' },
]

interface MetaPick {
  sessionData: Record<string, string>
  name: string
}

interface Props {
  account: Account
  onCancel: () => void
  onSaved: () => void
}

export function AccountEditForm({ account, onCancel, onSaved }: Props) {
  const qc = useQueryClient()
  const [username, setUsername] = useState(account.username)
  const [displayName, setDisplayName] = useState(account.displayName)
  const [avatar, setAvatar] = useState(account.avatar ?? '')
  const [status, setStatus] = useState<AccountStatus>(account.status)
  const [proxyId, setProxyId] = useState(account.proxyId ?? NONE)
  const [cookies, setCookies] = useState('')
  const [metaPick, setMetaPick] = useState<MetaPick | null>(null)

  const { data: proxies } = useQuery({
    queryKey: ['proxies'],
    queryFn: () => api.get<Proxy[]>('/proxies').then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: () => api.patch(`/accounts/${account.id}`, {
      username: username.trim(),
      displayName: displayName.trim(),
      avatar: avatar.trim() || undefined,
      status,
      proxyId: proxyId === NONE ? null : proxyId,
      // 后端是整体覆盖 sessionData，没填就别带这个字段，否则会把现有凭证抹掉
      ...(metaPick ? { sessionData: metaPick.sessionData } : {}),
      ...(!metaPick && cookies.trim() ? { sessionData: { cookies: cookies.trim() } } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      onSaved()
    },
  })

  const isMeta = account.platform === 'facebook' || account.platform === 'instagram'
  const canSubmit = username.trim() && displayName.trim() && !mutation.isPending

  return (
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
                <SelectItem key={p.id} value={p.id}>{p.label ?? `${p.host}:${p.port}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>更新登录凭证 <span className="text-muted-foreground">（留空则保持不变）</span></Label>
        {isMeta ? (
          <MetaRebind
            platform={account.platform === 'instagram' ? 'instagram' : 'facebook'}
            picked={metaPick}
            onPick={setMetaPick}
          />
        ) : (
          <Textarea
            placeholder="粘贴新的 Cookie（支持 Cookie-Editor 导出的 JSON）…"
            rows={3}
            value={cookies}
            onChange={(e) => setCookies(e.target.value)}
            className="font-mono text-xs"
          />
        )}
      </div>

      {mutation.isError && <p className="text-sm text-destructive">保存失败，请重试。</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} disabled={mutation.isPending}>取消</Button>
        <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
          {mutation.isPending ? '保存中…' : '保存修改'}
        </Button>
      </div>
    </div>
  )
}

/** 主页令牌没法手填——得先用系统用户令牌换出主页列表，再挑一个 */
function MetaRebind({ platform, picked, onPick }: {
  platform: 'facebook' | 'instagram'
  picked: MetaPick | null
  onPick: (p: MetaPick | null) => void
}) {
  const [token, setToken] = useState('')
  const [result, setResult] = useState<LinkablePagesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isInstagram = platform === 'instagram'

  async function loadPages() {
    setLoading(true)
    setError('')
    try {
      const res = await api.post<LinkablePagesResult>('/facebook/pages', { token: token.trim() })
      setResult(res.data)
      setToken('') // 系统用户令牌只用于换主页凭证，换完就不留在前端状态里
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '读取主页列表失败')
    } finally {
      setLoading(false)
    }
  }

  if (picked) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-sm flex-1 min-w-0 truncate">已选择「{picked.name}」，保存后生效</span>
        <Button variant="ghost" size="sm" className="h-7" onClick={() => { onPick(null); setResult(null) }}>
          撤销
        </Button>
      </div>
    )
  }

  if (result) {
    const linkable = result.pages.filter((p) => !isInstagram || p.instagram)
    return (
      <div className="space-y-2">
        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {describeToken(result)}
        </p>
        {!linkable.length ? (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            读到了 {result.pages.length} 个主页，但都没有关联 Instagram 专业账号。
          </p>
        ) : (
          linkable.map((p) => {
            const ig = p.instagram
            const label = isInstagram && ig ? `@${ig.username}` : p.name
            return (
              <button
                key={p.pageId}
                type="button"
                onClick={() => onPick({
                  sessionData: isInstagram && ig
                    ? { igUserId: ig.igUserId, pageAccessToken: p.accessToken }
                    : { pageId: p.pageId, pageAccessToken: p.accessToken },
                  name: label,
                })}
                className="w-full flex items-center gap-3 rounded-lg border p-2.5 text-left hover:bg-muted/50"
              >
                <img
                  src={(isInstagram ? ig?.avatar : p.avatar) ?? ''}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full bg-muted object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {isInstagram && ig ? `${ig.followers} 粉丝 · 来自主页 ${p.name}` : `${p.followers} 粉丝`}
                  </p>
                </div>
              </button>
            )
          })
        )}
        <Button variant="ghost" size="sm" onClick={() => setResult(null)}>返回</Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="粘贴系统用户令牌 EAA… 换取新的主页凭证"
        className="font-mono text-xs"
      />
      <p className="text-xs text-muted-foreground">
        在商务管理平台「商务设置 → 用户 → 系统用户」生成，需勾选 pages_show_list、
        pages_read_engagement、pages_manage_posts
        {isInstagram && '、instagram_basic、instagram_content_publish'}
        。令牌只用于换取主页凭证，不会被保存。
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button variant="outline" size="sm" onClick={loadPages} disabled={token.trim().length < 20 || loading}>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {loading ? '读取中…' : '读取主页列表'}
      </Button>
    </div>
  )
}
