import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssetPicker } from '@/components/assets/AssetPicker'
import { api } from '@/lib/api'
import { contentTypeLabel, platformLabel, allPlatforms, allContentTypes } from './constants'
import type { Content, ContentType, Platform } from '@/types'

interface Props {
  open: boolean
  /** 传入即为编辑，留空即为新建 */
  content?: Content | null
  onClose: () => void
}

type AssetSlot = 'asset' | 'cover'

function SlotTab({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

interface FormState {
  title: string
  type: ContentType
  assetId: string | null
  thumbnailAssetId: string | null
  fileUrl: string
  thumbnailUrl: string
  caption: string
  hashtags: string
  platforms: Platform[]
}

const EMPTY: FormState = {
  title: '',
  type: 'video',
  assetId: null,
  thumbnailAssetId: null,
  fileUrl: '',
  thumbnailUrl: '',
  caption: '',
  hashtags: '',
  platforms: ['tiktok'],
}

export function ContentFormDialog({ open, content, onClose }: Props) {
  const qc = useQueryClient()
  const isEdit = Boolean(content)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [slot, setSlot] = useState<AssetSlot>('asset')

  useEffect(() => {
    if (!open) return
    setForm(content ? toForm(content) : EMPTY)
    setSlot('asset')
  }, [open, content])

  const mutation = useMutation({
    mutationFn: () => {
      const payload = toPayload(form)
      return isEdit ? api.patch(`/contents/${content!.id}`, payload) : api.post('/contents', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contents'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      onClose()
    },
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function togglePlatform(p: Platform) {
    set('platforms', form.platforms.includes(p)
      ? form.platforms.filter((x) => x !== p)
      : [...form.platforms, p])
  }

  const canSubmit = form.title.trim().length > 0 && form.platforms.length > 0 && !mutation.isPending
  const hasCover = Boolean(form.thumbnailAssetId) || form.thumbnailUrl.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑作品' : '新建作品'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            {/* 左栏：作品长什么样。作品文件和封面共用一个大预览，用标签切 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex gap-1 rounded-md bg-muted p-1">
                  <SlotTab active={slot === 'asset'} onClick={() => setSlot('asset')}>作品文件</SlotTab>
                  {/* 大部分作品其实没设封面，合并预览后不写出来就看不见了 */}
                  <SlotTab active={slot === 'cover'} onClick={() => setSlot('cover')}>
                    封面{hasCover ? '' : ' · 未设置'}
                  </SlotTab>
                </div>

                {slot === 'asset' ? (
                  <div className="space-y-1.5">
                    <AssetPicker
                      value={form.assetId}
                      onChange={(a) => set('assetId', a?.id ?? null)}
                      type={form.type === 'image' ? 'image' : 'video'}
                    />
                    {!form.assetId && (
                      <>
                        <Input placeholder="或填外链 https://…" value={form.fileUrl} onChange={(e) => set('fileUrl', e.target.value)} />
                        <p className="text-xs text-muted-foreground">平台会自己来拉这个地址，必须是公网可访问的 http/https 链接</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <AssetPicker
                      value={form.thumbnailAssetId}
                      onChange={(a) => set('thumbnailAssetId', a?.id ?? null)}
                      type="image"
                    />
                    {!form.thumbnailAssetId && (
                      <Input placeholder="或填外链 https://…" value={form.thumbnailUrl} onChange={(e) => set('thumbnailUrl', e.target.value)} />
                    )}
                    <p className="text-xs text-muted-foreground">封面选填，不设就用作品文件本身</p>
                  </div>
                )}
              </div>

              {/* 类型和平台是次要的开关，压扁一点，高度让给预览 */}
              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-xs text-muted-foreground">类型</Label>
                <Select value={form.type} onValueChange={(v) => set('type', v as ContentType)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allContentTypes.map((t) => (
                      <SelectItem key={t} value={t}>{contentTypeLabel[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">目标平台</Label>
                <div className="flex flex-wrap gap-1.5">
                  {allPlatforms.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={`rounded px-2 py-0.5 text-[11px] font-medium border transition-colors ${
                        form.platforms.includes(p)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {platformLabel[p]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 右栏：作品写了什么，文案撑满剩下的高度 */}
            <div className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label>标题</Label>
                <Input placeholder="作品标题" value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>

              <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
                <Label>文案</Label>
                <Textarea
                  placeholder="写点什么…"
                  value={form.caption}
                  onChange={(e) => set('caption', e.target.value)}
                  className="min-h-[12rem] flex-1 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label>话题标签</Label>
                <Input placeholder="#热门 #推荐" value={form.hashtags} onChange={(e) => set('hashtags', e.target.value)} />
              </div>
            </div>
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">{errorText(mutation.error)}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>取消</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending ? '保存中…' : isEdit ? '保存修改' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function toForm(c: Content): FormState {
  return {
    title: c.title,
    type: c.type,
    assetId: c.assetId ?? null,
    thumbnailAssetId: c.thumbnailAssetId ?? null,
    fileUrl: c.fileUrl ?? '',
    thumbnailUrl: c.thumbnailUrl ?? '',
    caption: c.caption ?? '',
    hashtags: c.hashtags.map((h) => `#${h}`).join(' '),
    platforms: c.platforms,
  }
}

function toPayload(form: FormState) {
  return {
    title: form.title.trim(),
    type: form.type,
    // 清空要传 null，传 undefined 会被 JSON 直接丢掉，编辑时改动就静默失效了
    assetId: form.assetId,
    thumbnailAssetId: form.thumbnailAssetId,
    fileUrl: form.assetId ? null : form.fileUrl.trim() || null,
    thumbnailUrl: form.thumbnailAssetId ? null : form.thumbnailUrl.trim() || null,
    caption: form.caption.trim() || null,
    hashtags: form.hashtags.split(/[\s,]+/).filter(Boolean).map((h) => h.replace(/^#/, '')),
    platforms: form.platforms,
  }
}

function errorText(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
  if (Array.isArray(message)) return message.join('；')
  return message ?? '保存失败，请重试'
}
