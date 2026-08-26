import { useState } from 'react'
import { Plus, Upload, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlatformBadge } from '@/components/PlatformBadge'
import { AddContentDialog } from '@/components/contents/AddContentDialog'
import { api } from '@/lib/api'
import type { Content } from '@/types'

export default function ContentsPage() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['contents'],
    queryFn: () => api.get<{ data: Content[]; total: number }>('/contents').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contents'] }),
  })

  const contents = data?.data ?? []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Library</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} items</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Content
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-muted/30 aspect-video animate-pulse" />
          ))}
        </div>
      ) : contents.length === 0 ? (
        <div className="rounded-xl border border-dashed p-16 text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No content yet. Add your first video or image.</p>
          <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>
            Add Content
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {contents.map((item) => (
            <div key={item.id} className="rounded-xl border overflow-hidden hover:shadow-md transition-shadow group relative">
              <div className="aspect-video bg-muted">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.title} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs uppercase tracking-wide">
                    {item.type}
                  </div>
                )}
              </div>
              <button
                className="absolute top-2 right-2 h-6 w-6 rounded-md bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white"
                onClick={() => deleteMutation.mutate(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="p-3 space-y-1.5">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{item.type}</Badge>
                  {item.platforms.slice(0, 2).map((p) => (
                    <PlatformBadge key={p} platform={p} />
                  ))}
                  {item.platforms.length > 2 && (
                    <span className="text-xs text-muted-foreground">+{item.platforms.length - 2}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddContentDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
