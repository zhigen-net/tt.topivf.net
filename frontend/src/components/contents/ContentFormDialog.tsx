import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { contentTypeLabel, platformLabel, allPlatforms, allContentTypes } from './constants'
import type { Content, ContentType, Platform } from '@/types'

interface Props {
  open: boolean
  /** 传入即为编辑，留空即为新建 */
  content?: Content | null
  onClose: () => void
}

interface FormState {
  title: string
  type: ContentType
  fileUrl: string
  thumbnailUrl: string
  caption: string
  hashtags: string
  platforms: Platform[]
}

const EMPTY: FormState = {
  title: '',
  type: 'video',
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

  useEffect(() => {
    if (!open) return
    setForm(content ? toForm(content) : EMPTY)
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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑作品' : '新建作品'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>标题</Label>
              <Input placeholder="作品标题" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v as ContentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allContentTypes.map((t) => (
                    <SelectItem key={t} value={t}>{contentTypeLabel[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>文件地址</Label>
            <Input placeholder="https://…" value={form.fileUrl} onChange={(e) => set('fileUrl', e.target.value)} />
            <p className="text-xs text-muted-foreground">平台会自己来拉这个地址，必须是公网可访问的 http/https 链接</p>
          </div>

          <div className="space-y-1.5">
            <Label>封面地址 <span className="text-muted-foreground">（选填）</span></Label>
            <Input placeholder="https://…" value={form.thumbnailUrl} onChange={(e) => set('thumbnailUrl', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>文案</Label>
            <Textarea placeholder="写点什么…" rows={3} value={form.caption} onChange={(e) => set('caption', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>话题标签</Label>
            <Input placeholder="#热门 #推荐" value={form.hashtags} onChange={(e) => set('hashtags', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>目标平台</Label>
            <div className="flex flex-wrap gap-2">
              {allPlatforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${
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
    fileUrl: form.fileUrl.trim() || null,
    thumbnailUrl: form.thumbnailUrl.trim() || null,
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
