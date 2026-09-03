import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AssetThumb } from './AssetThumb'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Asset, AssetType, PaginatedResponse } from '@/types'

interface Props {
  value: string | null
  onChange: (asset: Asset | null) => void
  /** 只让选某一类素材，比如封面只能选图片 */
  type?: AssetType
  disabled?: boolean
}

const ACCEPT: Record<AssetType | 'all', string> = {
  all: 'video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/quicktime,video/webm',
  image: 'image/jpeg,image/png,image/webp,image/gif',
}

export function AssetPicker({ value, onChange, type, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['assets', 'picker', type ?? 'all', search],
    queryFn: () =>
      api
        .get<PaginatedResponse<Asset>>('/assets', {
          params: { type, search: search || undefined, limit: 60 },
        })
        .then((r) => r.data),
    enabled: open,
  })

  // 已选素材的文件名/缩略图不在表单里，单独按 id 拉一次
  const { data: current } = useQuery({
    queryKey: ['asset', value],
    queryFn: () => api.get<Asset>(`/assets/${value}`).then((r) => r.data),
    enabled: Boolean(value),
  })

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post<Asset>('/assets', form, { timeout: 10 * 60_000 }).then((r) => r.data)
    },
    onSuccess: (asset) => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      onChange(asset)
      setOpen(false)
    },
  })

  const assets = data?.data ?? []

  return (
    <>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border p-2">
          {current && <AssetThumb asset={current} className="h-10 w-10 shrink-0 rounded" />}
          <span className="min-w-0 flex-1 truncate text-sm">{current?.filename ?? '素材加载中…'}</span>
          {!disabled && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>更换</Button>
              <button
                title="移除"
                onClick={() => onChange(null)}
                className="rounded p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)} disabled={disabled}>
          从素材库选择
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>选择素材</DialogTitle></DialogHeader>

          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文件名"
              className="flex-1"
            />
            <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
              <Upload className="h-4 w-4" />
              {upload.isPending ? '上传中…' : '上传新素材'}
            </Button>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              accept={ACCEPT[type ?? 'all']}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) upload.mutate(file)
                e.target.value = ''
              }}
            />
          </div>

          {upload.isError && <p className="text-sm text-destructive">上传失败，请重试。</p>}

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
            ) : assets.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">没有可选素材</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {assets.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      onChange(a)
                      setOpen(false)
                    }}
                    className={cn(
                      'overflow-hidden rounded-lg border text-left transition-colors hover:border-primary',
                      a.id === value && 'border-primary ring-1 ring-primary',
                    )}
                  >
                    <div className="relative">
                      <AssetThumb asset={a} className="aspect-square w-full" />
                      {a.id === value && (
                        <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <p className="truncate p-1.5 text-xs" title={a.filename}>{a.filename}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
