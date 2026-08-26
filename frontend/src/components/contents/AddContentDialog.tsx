import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import type { ContentType, Platform } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

const contentTypes: { value: ContentType; label: string }[] = [
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
]

const allPlatforms: Platform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook']
const platformLabel: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'X / Twitter',
  facebook: 'Facebook',
}

export function AddContentDialog({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ContentType>('video')
  const [fileUrl, setFileUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>(['tiktok'])

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/contents', {
        title,
        type,
        fileUrl: fileUrl || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        caption: caption || undefined,
        hashtags: hashtags.split(/[\s,]+/).filter(Boolean).map((h) => h.replace(/^#/, '')),
        platforms,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contents'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      handleClose()
    },
  })

  function handleClose() {
    setTitle('')
    setType('video')
    setFileUrl('')
    setThumbnailUrl('')
    setCaption('')
    setHashtags('')
    setPlatforms(['tiktok'])
    onClose()
  }

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Content</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="Content title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ContentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {contentTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>File URL</Label>
            <Input placeholder="https://..." value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Thumbnail URL <span className="text-muted-foreground">(optional)</span></Label>
            <Input placeholder="https://..." value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Caption</Label>
            <Textarea placeholder="Write a caption…" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Hashtags</Label>
            <Input placeholder="#trending #viral" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {allPlatforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`rounded-md px-3 py-1 text-xs font-medium border transition-colors ${
                    platforms.includes(p)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-input text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {platformLabel[p]}
                </button>
              ))}
            </div>
          </div>

          {mutation.isError && <p className="text-sm text-destructive">Failed to add content. Please try again.</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || platforms.length === 0 || mutation.isPending}
          >
            {mutation.isPending ? 'Adding…' : 'Add Content'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
