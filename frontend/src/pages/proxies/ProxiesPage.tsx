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
        <DialogHeader><DialogTitle>Add Proxy</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Host</Label>
              <Input placeholder="1.2.3.4" value={host} onChange={(e) => setHost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input type="number" placeholder="8080" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Protocol</Label>
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
              <Label>Username <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Password <span className="text-muted-foreground">(optional)</span></Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Label <span className="text-muted-foreground">(optional)</span></Label>
              <Input placeholder="US Residential" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Country <span className="text-muted-foreground">(optional)</span></Label>
              <Input placeholder="US" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
          {mutation.isError && <p className="text-sm text-destructive">Failed to add proxy.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!host.trim() || !port || mutation.isPending}
          >
            {mutation.isPending ? 'Adding…' : 'Add Proxy'}
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proxies</h1>
          <p className="text-muted-foreground text-sm mt-1">{proxies.length} proxies configured</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Proxy
          </Button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Label</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Host : Port</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Protocol</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Auth</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Country</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : proxies.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No proxies configured.</td></tr>
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
                  <td className="px-4 py-3">
                    {proxy.isHealthy
                      ? <span className="flex items-center gap-1 text-emerald-500 text-xs"><Wifi className="h-3.5 w-3.5" />Healthy</span>
                      : <span className="flex items-center gap-1 text-red-500 text-xs"><WifiOff className="h-3.5 w-3.5" />Down</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(proxy.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
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
