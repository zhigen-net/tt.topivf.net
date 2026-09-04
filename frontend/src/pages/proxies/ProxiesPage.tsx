import { useState } from 'react'
import { Plus, RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import type { Proxy } from '@/types'

function AddProxyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [protocol, setProtocol] = useState<'http' | 'socks5'>('http')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [label, setLabel] = useState('')
  const [country, setCountry] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/proxies', {
        host,
        port: parseInt(port),
        protocol,
        username: username || undefined,
        password: password || undefined,
        label: label || undefined,
        country: country || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proxies'] })
      handleClose()
    },
  })

  function handleClose() {
    setHost('')
    setPort('')
    setProtocol('http')
    setUsername('')
    setPassword('')
    setLabel('')
    setCountry('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>添加代理</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>主机</Label>
              <Input placeholder="1.2.3.4" value={host} onChange={(e) => setHost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>端口</Label>
              <Input type="number" placeholder="8080" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>协议</Label>
            <Select value={protocol} onValueChange={(v) => setProtocol(v as 'http' | 'socks5')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP</SelectItem>
                <SelectItem value="socks5">SOCKS5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>用户名 <span className="text-muted-foreground">(可选)</span></Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>密码 <span className="text-muted-foreground">(可选)</span></Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>名称 <span className="text-muted-foreground">(可选)</span></Label>
              <Input placeholder="美国住宅" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>国家 <span className="text-muted-foreground">(可选)</span></Label>
              <Input placeholder="US" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
          {mutation.isError && <p className="text-sm text-destructive">添加失败</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>取消</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!host.trim() || !port || mutation.isPending}
          >
            {mutation.isPending ? '添加中…' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProxiesPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['proxies'],
    queryFn: () => api.get<Proxy[]>('/proxies').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/proxies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxies'] }),
  })

  const proxies = data ?? []

  function health(proxy: Proxy) {
    return proxy.isHealthy
      ? <span className="flex items-center gap-1 text-emerald-500 text-xs"><Wifi className="h-3.5 w-3.5" />正常</span>
      : <span className="flex items-center gap-1 text-red-500 text-xs"><WifiOff className="h-3.5 w-3.5" />不可用</span>
  }

  function deleteButton(proxy: Proxy) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        title="删除"
        onClick={() => deleteMutation.mutate(proxy.id)}
        disabled={deleteMutation.isPending}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm">共 {proxies.length} 个代理</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">添加代理</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
      ) : proxies.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">还没有配置代理</p>
      ) : (
        <div className="space-y-2 md:hidden">
          {proxies.map((proxy) => (
            <div key={proxy.id} className="rounded-xl border bg-background p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{proxy.label ?? proxy.host}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{proxy.host}:{proxy.port}</p>
                </div>
                {health(proxy)}
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="uppercase text-xs">{proxy.protocol}</Badge>
                  {proxy.username ?? '免密'}
                  {proxy.country && ` · ${proxy.country}`}
                </span>
                <div className="shrink-0">{deleteButton(proxy)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="hidden md:block rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">名称</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">地址</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">协议</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">账号</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">国家</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">加载中…</td></tr>
            ) : proxies.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">还没有配置代理</td></tr>
            ) : (
              proxies.map((proxy) => (
                <tr key={proxy.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{proxy.label ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{proxy.host}:{proxy.port}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="uppercase text-xs">{proxy.protocol}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {proxy.username ? proxy.username : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{proxy.country ?? '—'}</td>
                  <td className="px-4 py-3">{health(proxy)}</td>
                  <td className="px-4 py-3 text-right">{deleteButton(proxy)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddProxyDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
