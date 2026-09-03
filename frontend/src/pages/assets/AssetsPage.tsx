import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssetThumb } from '@/components/assets/AssetThumb'
import { api } from '@/lib/api'
import { useWorkspace } from '@/lib/workspace'
import type { Asset, AssetType, PaginatedResponse } from '@/types'

type Filter = 'all' | AssetType | 'unreferenced'

export default function AssetsPage() {
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const canEdit = can('member')
  const fileInput = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [removing, setRemoving] = useState<Asset | null>(null)

  const params = {
    search: search || undefined,
    type: filter === 'video' || filter === 'image' ? filter : undefined,
    unreferenced: filter === 'unreferenced' ? 'true' : undefined,
    limit: 48,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['assets', filter, search],
    queryFn: () => api.get<PaginatedResponse<Asset>>('/assets', { params }).then((r) => r.data),
  })

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      // 大文件走默认 30s 超时会断，这里单独放宽
      return api.post('/assets', form, { timeout: 10 * 60_000 })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => {
      setRemoving(null)
      qc.invalidateQueries({ queryKey: ['assets'] })
    },
  })

  const assets = data?.data ?? []

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">素材库</h1>
          <p className="mt-1 text-sm text-muted-foreground">共 {data?.total ?? 0} 个文件</p>
        </div>
        {canEdit && (
          <Button onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">{upload.isPending ? '上传中…' : '上传素材'}</span>
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload.mutate(file)
            e.target.value = ''
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索文件名"
          className="max-w-56"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="video">视频</SelectItem>
            <SelectItem value="image">图片</SelectItem>
            <SelectItem value="unreferenced">未被引用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(upload.isError || remove.isError) && (
        <p className="text-sm text-destructive">{errorText(upload.error ?? remove.error)}</p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl border bg-muted/30" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">还没有素材</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((a) => (
            <div key={a.id} className="group overflow-hidden rounded-xl border bg-background">
              <AssetThumb asset={a} className="aspect-square w-full" />
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium" title={a.filename}>{a.filename}</p>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-muted-foreground">{formatSize(a.size)}</span>
                  <div className="flex items-center gap-1">
                    {a.referenced && <Badge variant="secondary" className="text-[10px]">已引用</Badge>}
                    {canEdit && !a.referenced && (
                      <button
                        title="删除"
                        onClick={() => setRemoving(a)}
                        className="rounded p-1 text-destructive transition-colors hover:bg-accent"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {removing && (
        <Dialog open onOpenChange={(o) => !o && setRemoving(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>删除素材</DialogTitle></DialogHeader>
            <p className="text-sm">删除「{removing.filename}」后文件不可恢复。确定删除？</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoving(null)}>取消</Button>
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function errorText(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 413) return '文件太大，超过了服务端上限。'
    const msg = (err.response?.data as { message?: string | string[] } | undefined)?.message
    if (Array.isArray(msg)) return msg.join('；')
    if (msg) return msg
  }
  return '操作失败，请重试。'
}
