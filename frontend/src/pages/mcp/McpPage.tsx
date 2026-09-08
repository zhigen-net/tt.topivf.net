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
import { cn } from '@/lib/utils'
import { useAllAccounts } from '@/lib/accounts'
import { useMe } from '@/lib/auth'
import { useWorkspace } from '@/lib/workspace'
import { WORKSPACE_ROLE_LABELS } from '@/lib/workspace-labels'
import { MCP_SCOPES } from '@/types'
import type { ApiKey, McpScope } from '@/types'

const SCOPE_LABELS: Record<McpScope, { label: string; hint: string }> = {
  'assets:read': { label: '查看素材库', hint: '列出已上传的图片和视频，拿到 id 挂给作品' },
  'assets:write': { label: '导入素材', hint: '让服务器按公网链接下载文件存进素材库，内网地址会被拒绝' },
  'contents:read': { label: '查看作品', hint: '读取作品库、审核状态与发布情况' },
  'contents:write': { label: '创建 / 修改作品', hint: '新建草稿、改文案、提交审核' },
  'contents:review': { label: '审核作品', hint: 'AI 可以自行通过或驳回，相当于绕过人工审核' },
  'accounts:read': { label: '查看社交账号', hint: '只返回昵称与粉丝数，不含任何登录凭证' },
  'tasks:read': { label: '查看发布任务', hint: '读取排期与发布结果' },
  'tasks:publish': { label: '发布作品', hint: 'AI 可以把已过审的作品真的发出去' },
  'analytics:read': { label: '查看数据趋势', hint: '读取粉丝、互动的历史快照' },
}

const ENDPOINT = `${window.location.origin}/api/v1/mcp`

export default function McpPage() {
  const qc = useQueryClient()
  const { workspace, can } = useWorkspace()
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">MCP 服务</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            让各类 AI 客户端接入「{workspace?.name ?? '当前空间'}」，直接查账号、建作品、审核和发布
          </p>
        </div>
        {can('member') && (
          <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">新建服务</span>
          </Button>
        )}
      </div>

      <div className="max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">服务地址</CardTitle>
            <CardDescription>空间内所有服务共用这个地址，靠各自的密钥区分身份与权限</CardDescription>
          </CardHeader>
          <CardContent>
            <CopyLine value={ENDPOINT} />
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
        ) : keys.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              还没有 MCP 服务。一个空间可以建多个，每个服务的密钥、账号范围和权限相互独立。
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div key={k.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{k.name}</p>
                    {/* Agent 侧的服务名，多服务并存时靠它对号入座 */}
                    <p className="truncate font-mono text-xs text-muted-foreground">socialhub-{k.prefix}</p>
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

                {can('member') && (
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
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateKeyDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onIssued={(r) => { setCreateOpen(false); setIssued(r) }}
      />

      <IssuedTokenDialog issued={issued} onClose={() => setIssued(null)} />

      {removing && (
        <Dialog open onOpenChange={(o) => !o && setRemoving(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>删除服务</DialogTitle></DialogHeader>
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
    </div>
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

  const accounts = useAllAccounts(open)

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
          <DrawerTitle>新建 MCP 服务</DrawerTitle>
          <p className="mt-1 text-sm text-muted-foreground">一个服务 = 一把独立密钥 + 账号范围 + 权限范围</p>
        </DrawerHeader>

        <DrawerBody>
          <Section step={1} title="基本信息" hint="服务固定绑当前空间和你自己，AI 的操作都会记在你名下">
            <div className="space-y-1.5">
              <Label>服务名称</Label>
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
            {mutation.isPending ? '创建中…' : '创建服务'}
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
  const { workspace } = useWorkspace()
  const key = issued?.apiKey
  const token = issued?.token ?? ''
  // 同一个 Agent 可能同时挂多个 SocialHub 服务，重名会互相覆盖，用密钥前缀保证唯一
  const serverName = key ? `socialhub-${key.prefix}` : 'socialhub'
  const scopeText = key?.accountIds ? `${key.accountIds.length} 个指定账号` : '空间内全部账号'

  const cli = `claude mcp add --transport http ${serverName} ${ENDPOINT} --header "Authorization: Bearer ${token}"`
  const config = JSON.stringify({
    mcpServers: {
      [serverName]: { type: 'http', url: ENDPOINT, headers: { Authorization: `Bearer ${token}` } },
    },
  }, null, 2)
  const curl = [
    `curl -X POST ${ENDPOINT} \\`,
    `  -H "Authorization: Bearer ${token}" \\`,
    '  -H "Content-Type: application/json" \\',
    '  -H "Accept: application/json, text/event-stream" \\',
    `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
  ].join('\n')
  const prompt = buildPrompt({
    serverName,
    cli,
    config,
    curl,
    token,
    label: key?.name ?? '',
    workspaceName: workspace?.name ?? '',
    scopeText,
    scopes: key?.scopes ?? [],
  })

  return (
    <Dialog open={Boolean(issued)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>服务已创建</DialogTitle></DialogHeader>

        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          这是唯一一次能拿到完整密钥的机会，关掉后取不回来。下面三份物料里都已经带上了它。
        </p>

        <dl className="rounded-md border text-sm">
          <InfoRow label="服务名" value={serverName} mono />
          <InfoRow label="工作空间" value={workspace?.name ?? '—'} />
          <InfoRow label="账号范围" value={scopeText} />
        </dl>

        <div className="space-y-2">
          <Label>复制接入物料</Label>
          <CopyRow
            title="提示词（推荐）"
            hint="直接发给 Agent，它会自行接入并按规则使用。含密钥，别外传"
            value={prompt}
          />
          <CopyRow
            title="配置文件"
            hint="并进客户端的 mcpServers 字段，别覆盖已有服务"
            value={config}
          />
          <CopyRow
            title="调用示例"
            hint="客户端不支持 MCP 时，照这个发 HTTP 请求，能力等价"
            value={curl}
          />
          <CopyRow
            title="命令行"
            hint="仅 Claude Code，粘到终端执行"
            value={cli}
          />
          <CopyRow
            title="密钥"
            hint="只要密钥本身"
            value={token}
          />
        </div>

        <DialogFooter>
          <Button onClick={onClose}>我已保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const SCOPE_TOOLS: Record<McpScope, string> = {
  'assets:read': '- list_assets：翻素材库，按类型/文件名筛，unused 只看没被作品用过的；返回的 id 就是 assetId',
  'assets:write': '- import_asset_from_url：给一个公网直链，服务器把文件下下来存进素材库并返回 id',
  'contents:read': '- list_contents：分页查作品，可按关键词、平台、审核状态过滤\n- get_content：按 id 看单个作品详情',
  'contents:write': '- create_content：新建作品，落地即草稿\n- update_content：改作品；改动会让已有审核结论作废、退回草稿\n- submit_content：把草稿或被驳回的作品送去审核',
  'contents:review': '- review_content：approve 通过 / reject 驳回，驳回必须在 note 里写清理由',
  'accounts:read': '- list_accounts：列出你能操作的社交账号，返回值不含任何登录凭证',
  'tasks:read': '- list_tasks：查发布任务的排队、执行与结果',
  'tasks:publish': '- publish_content：把已过审的作品投到指定账号，scheduledAt 留空表示立即发布',
  'analytics:read': '- get_account_analytics：读某个账号的粉丝、互动历史快照',
}

const SCOPE_PROBE_TOOL: Record<McpScope, string> = {
  'assets:read': 'list_assets',
  'assets:write': 'import_asset_from_url',
  'contents:read': 'list_contents',
  'contents:write': 'create_content',
  'contents:review': 'review_content',
  'accounts:read': 'list_accounts',
  'tasks:read': 'list_tasks',
  'tasks:publish': 'publish_content',
  'analytics:read': 'get_account_analytics',
}

// 让 Agent 自查接入是否成功，得给一个这把密钥真的能看到的工具名。
// 优先挑 list_accounts：它同时能验证账号范围对不对，比翻素材库信息量大。
const PROBE_PREFERENCE: McpScope[] = ['accounts:read', 'contents:read', 'tasks:read', ...MCP_SCOPES]

function firstTool(scopes: McpScope[]): string {
  const hit = PROBE_PREFERENCE.find((s) => scopes.includes(s))
  return hit ? SCOPE_PROBE_TOOL[hit] : 'tools/list'
}

interface PromptInput {
  serverName: string
  cli: string
  config: string
  curl: string
  token: string
  label: string
  workspaceName: string
  scopeText: string
  scopes: McpScope[]
}

/**
 * 提示词按这把密钥实际拿到的权限裁剪，免得 Agent 去试它根本调不到的工具。
 * 开头那段服务标识是给多服务场景用的：同一个 Agent 挂着几个空间的 SocialHub 时，
 * 光看工具名分不出彼此，必须靠服务名把 id 的作用域框住。
 *
 * 接入说明把 HTTP 直调放在 MCP 注册前面：大多数 Agent 没有 MCP 运行时，
 * 让它先去装一遍只会卡在第一步，而这个端点本来就是无状态的裸 JSON-RPC，谁都能打。
 */
function buildPrompt({
  serverName, cli, config, curl, token, label, workspaceName, scopeText, scopes,
}: PromptInput): string {
  const tools = MCP_SCOPES.filter((s) => scopes.includes(s)).map((s) => SCOPE_TOOLS[s]).join('\n')
  const permissions = MCP_SCOPES.filter((s) => scopes.includes(s))
    .map((s) => SCOPE_LABELS[s].label)
    .join('、')

  const rules: string[] = [
    '所有结论和操作都必须基于工具返回的真实数据，不要虚构账号、作品或执行结果。',
    '同一个人设可能同时存在于多个平台。选账号时必须同时确认平台和账号 id，不得只按昵称选。',
    '作品 id、账号 id 都是 uuid，先用查询类工具拿到真实 id，不要自己编。',
    '需要创建或修改作品时，必须调用工具存进系统，不要只在聊天里输出文案。',
    '作品必须依次经过 草稿 →（submit_content）待审核 →（review_content）已通过 →（publish_content）发布，跳步会被服务端拒绝；作品一旦被修改，审核结论作废、退回草稿。',
  ]
  if (scopes.includes('assets:read')) {
    rules.push('作品的图片视频来自素材库，不要反过来问我要文件。先 list_assets 找现成的，把它的 id 填进 create_content 的 assetId（封面填 thumbnailAssetId）。')
  }
  if (scopes.includes('assets:write')) {
    rules.push('库里没有合适的素材时，用 import_asset_from_url 给一个公网直链让服务器自己下。链接要能直接下到文件本身，不能是网盘或预览页。')
  }
  if (!scopes.includes('assets:read') && !scopes.includes('assets:write')) {
    rules.push('这个服务没有素材库权限。需要配图配视频时，只能用 fileUrl 填公网直链，或者直接问我要。')
  }
  if (scopes.includes('contents:review')) {
    rules.push('你有审核权限，等于绕过了人工把关。批准前先自查文案合规、素材可访问、平台设置正确。')
  }
  if (scopes.includes('tasks:publish')) {
    rules.push('发布会对外产生真实影响且不可撤回。调 publish_content 之前，先把「作品标题 + 目标账号 + 发布时间」列出来让我确认。')
  }
  rules.push(
    '只能调用上面列出的工具。被拒绝说明这个服务没有该权限，直接告诉我，不要换参数重试。',
    '完成操作后，回报作品 id、标题、目标平台、账号 id 和当前状态；失败时回报具体错误，不要含糊带过。',
    '平台取值：tiktok、instagram、youtube、twitter、facebook；作品类型：video、image、reel、story；时间一律用 ISO 8601（如 2026-01-01T09:00:00Z）。',
    '我可能同时接入多个 SocialHub 服务，它们指向不同的工作空间或账号范围，数据互不相通。别的服务查到的 id 拿到这里会直接 404，不要跨服务传递 id；同时用到多个服务时，要标明每条数据出自哪个服务。',
    '不要输出、复述或记录上面的密钥，也不要把它发给其他服务。',
    '用中文回话。账号名、粉丝数、发布时间一律照工具返回值转述，不要估算或补全。',
  )

  return [
    '你是「SocialHub 社媒管理系统」的新媒体运营负责人。',
    '你的职责：在下面这个服务实际授权的范围内，完成内容创作、审核、发布和结果跟踪。',
    '',
    '━━ 第一步：接入服务 ━━',
    '',
    '下面不是普通文本配置，而是一个独立的 MCP Streamable HTTP 服务。请把它作为新的配置项',
    `追加到你当前 Agent 的 MCP 配置中；必须保留配置键「${serverName}」，`,
    '不要替换、覆盖或修改已有的其他 MCP 服务。',
    '',
    config,
    '',
    '如果你的运行环境不支持 MCP，改用 HTTP 直调，能力完全等价：',
    `- 地址：POST ${ENDPOINT}，只接受 POST（GET/DELETE 返回 405 是正常设计）。`,
    '- 请求头三个，一个都不能少：',
    `    Authorization: Bearer ${token}`,
    '    Content-Type: application/json',
    '    Accept: application/json, text/event-stream',
    '  最后那个 Accept 必须原样照抄。只写 application/json 或者不写，服务器会返回',
    '  406 Not Acceptable —— 这是接入失败最常见的原因，不是密钥问题。',
    '- 无状态端点：不需要 initialize，不需要维持会话，每次请求彼此独立。',
    '- 请求体是 JSON-RPC 2.0。列出工具：{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
    '  调用工具：{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"工具名","arguments":{}}}',
    '- 响应是 SSE 两行：event: message / data: {...}。取 "data: " 后面那段 JSON，',
    '  工具结果在 result.content[0].text，它本身还是 JSON 字符串，要再解析一次。',
    '  出错时看 error.message；result.isError 为 true 时原因在 content[0].text。',
    '- 用 Python 请走 requests 或手动设置 User-Agent；urllib 默认 UA 会被网关拦成 403，那不是权限问题。',
    '- 完整示例：',
    curl,
    `（补充：如果你是 Claude Code 命令行，一条命令就够：${cli}）`,
    '',
    `接入后先做一次自检：列出工具清单，再调用 ${firstTool(scopes)} 核对授权账号和权限对不对。`,
    '不要把上面的配置当参考资料跳过，也不要在没连上的情况下假装已经连上。',
    '失败就把 HTTP 状态码和完整响应原样发给我，不要自己改参数反复重试，也不要猜原因。',
    '',
    `━━ 第二步：以下说明只对服务 ${serverName} 有效 ━━`,
    '',
    '服务标识',
    `- 配置键：${serverName}`,
    `- 服务地址：${ENDPOINT}`,
    `- 用途备注：${label || '（未填写）'}`,
    `- 工作空间：${workspaceName || '（未知）'}`,
    `- 账号范围：${scopeText}`,
    `- 已授予权限：${permissions || '（没有勾选任何权限）'}`,
    '',
    '可用工具',
    tools || '（这个服务没有勾选任何权限）',
    '',
    '工作要求',
    ...rules.map((r, i) => `${i + 1}. ${r}`),
    '',
    '接入成功后，先告诉我你能访问哪些账号、有哪些能力，然后等我派任务。',
  ].join('\n')
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-0">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 truncate text-xs', mono && 'font-mono')}>{value}</dd>
    </div>
  )
}

function CopyRow({ title, hint, value }: { title: string; hint: string; value: string }) {
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
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? '已复制' : '复制'}
      </span>
    </button>
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
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{value}</code>
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
