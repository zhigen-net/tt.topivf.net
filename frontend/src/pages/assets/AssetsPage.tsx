import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Check, ChevronLeft, ChevronRight, Link2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AssetThumb } from '@/components/assets/AssetThumb'
import {
  AssetFilters, activeFilterCount, toQueryParams, useAssetFilters,
} from '@/components/assets/AssetFilters'
import { api } from '@/lib/api'
import { useWorkspace } from '@/lib/workspace'
import { tooLargeReason } from '@/lib/upload'
import type { Asset, PaginatedResponse } from '@/types'

const PAGE_SIZE = 24

export default function AssetsPage() {
  const qc = useQueryClient()
  const { can } = useWorkspace()
  const canEdit = can('member')
  const fileInput = useRef<HTMLInputElement>(null)
  const { filters, patch, reset } = useAssetFilters()
  const [searchInput, setSearchInput] = useState(filters.search)
  const [removing, setRemoving] = useState<Asset | null>(null)
  // 存 id 不存对象：分享链接生成后列表会刷新，弹层得跟着拿到新的那份
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [sizeError, setSizeError] = useState<string | null>(null)

  // 每敲一个字就打一次接口没必要，停下来再写回地址栏
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === filters.search) return
    const t = setTimeout(() => patch({ search: trimmed }), 300)
    return () => clearTimeout(t)
  }, [searchInput, filters.search, patch])

  const params = useMemo(() => toQueryParams(filters, PAGE_SIZE), [filters])

  const { data, isLoading } = useQuery({
    queryKey: ['assets', params],
    queryFn: () => api.get<PaginatedResponse<Asset>>('/assets', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
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

  const share = useMutation({
    mutationFn: (id: string) => api.post<Pick<Asset, 'shareUrl' | 'shareExpiresAt'>>(`/assets/${id}/share`)
      .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })

  const unshare = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}/share`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })

  const assets = data?.data ?? []
  const totalPages = data?.totalPages ?? 1
  const preview = assets.find((a) => a.id === previewId) ?? null

  async function copyLink(a: Asset) {
    const url = a.shareUrl ?? await share.mutateAsync(a.id).then((r) => r.shareUrl).catch(() => null)
    if (!url) return

    try {
      await navigator.clipboard.writeText(url)
      setCopied(a.id)
      setTimeout(() => setCopied((c) => (c === a.id ? null : c)), 2000)
    } catch {
      // 剪贴板可能被浏览器拦掉，退回预览层让用户自己选中复制
      setPreviewId(a.id)
    }
  }

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
            e.target.value = ''
            if (!file) return
            const reason = tooLargeReason(file)
            setSizeError(reason)
            if (!reason) upload.mutate(file)
          }}
        />
      </div>

      <AssetFilters
        filters={filters}
        patch={patch}
        reset={() => {
          setSearchInput('')
          reset()
        }}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
      />

      {sizeError && <p className="text-sm text-destructive">{sizeError}</p>}

      {(upload.isError || remove.isError || share.isError || unshare.isError) && (
        <p className="text-sm text-destructive">
          {errorText(upload.error ?? remove.error ?? share.error ?? unshare.error)}
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl border bg-muted/30" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {activeFilterCount(filters) ? '没有匹配的素材' : '还没有素材'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((a) => (
            <div key={a.id} className="group overflow-hidden rounded-xl border bg-background">
              <button
                onClick={() => setPreviewId(a.id)}
                title="预览"
                className="block w-full cursor-zoom-in"
              >
                <AssetThumb asset={a} className="aspect-square w-full" />
              </button>
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium" title={a.filename}>{a.filename}</p>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-muted-foreground">{formatSize(a.size)}</span>
                  <div className="flex items-center gap-1">
                    {a.referenced && <Badge variant="secondary" className="text-[10px]">已引用</Badge>}
                    {(canEdit || a.shareUrl) && (
                      <button
                        title={a.shareUrl ? '复制分享链接' : '生成并复制分享链接'}
                        onClick={() => void copyLink(a)}
                        disabled={share.isPending}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent"
                      >
                        {copied === a.id
                          ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                          : <Link2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="icon"
            disabled={filters.page <= 1}
            onClick={() => patch({ page: filters.page - 1 })}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">第 {filters.page} / {totalPages} 页</span>
          <Button
            variant="outline"
            size="icon"
            disabled={filters.page >= totalPages}
            onClick={() => patch({ page: filters.page + 1 })}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {preview && (
        <Dialog open onOpenChange={(o) => !o && setPreviewId(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="truncate pr-6 text-base">{preview.filename}</DialogTitle>
            </DialogHeader>

            {preview.type === 'image' ? (
              <img src={preview.url} alt={preview.filename} className="max-h-[60vh] w-full object-contain" />
            ) : (
              <video src={preview.url} controls className="max-h-[60vh] w-full bg-black" />
            )}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {formatSize(preview.size)} · {preview.mimeType} · 上传于 {new Date(preview.createdAt).toLocaleDateString()}
              </p>

              {preview.shareUrl ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={preview.shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 text-xs"
                    />
                    <Button variant="outline" onClick={() => void copyLink(preview)}>
                      {copied === preview.id ? '已复制' : '复制'}
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        onClick={() => unshare.mutate(preview.id)}
                        disabled={unshare.isPending}
                      >
                        撤销
                      </Button>
                    )}
                  </div>
                  {preview.shareExpiresAt && (
                    <p className="text-xs text-muted-foreground">
                      任何人都能打开，有效期至 {new Date(preview.shareExpiresAt).toLocaleDateString()}；撤销后立即失效。
                    </p>
                  )}
                </>
              ) : canEdit ? (
                <Button variant="outline" onClick={() => void copyLink(preview)} disabled={share.isPending}>
                  <Link2 className="h-4 w-4" />
                  {share.isPending ? '生成中…' : '生成并复制分享链接'}
                </Button>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
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
    if (err.response?.status === 413) return '文件太大被拦下了，上限是 95 MB。'
    const msg = (err.response?.data as { message?: string | string[] } | undefined)?.message
    if (Array.isArray(msg)) return msg.join('；')
    if (msg) return msg
  }
  return '操作失败，请重试。'
}
