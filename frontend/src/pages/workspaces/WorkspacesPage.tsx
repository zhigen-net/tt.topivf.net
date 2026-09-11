import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useWorkspace } from '@/lib/workspace'
import type { Workspace } from '@/types'

export default function WorkspacesPage() {
  const { workspaces, workspace: current, switchTo, isLoading } = useWorkspace()
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<Workspace | null>(null)
  const [removing, setRemoving] = useState<Workspace | null>(null)

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">空间管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            平台上的全部工作空间。要管理某个空间的成员、凭证和代理，先切换过去，再到「工作空间」里操作。
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          新建空间
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-2 p-3 sm:p-4">
          {isLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
          {!isLoading && !workspaces.length && (
            <p className="text-sm text-muted-foreground">还没有任何工作空间，先新建一个。</p>
          )}
          {workspaces.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div className="flex min-w-0 items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{w.name}</span>
                    {w.id === current?.id && <Badge variant="secondary" className="shrink-0">当前</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    成员 {w.memberCount} 人 · 创建于 {new Date(w.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {w.id !== current?.id && (
                  <Button variant="outline" size="sm" onClick={() => switchTo(w.id)}>切换</Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" title="重命名" onClick={() => setRenaming(w)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="删除" onClick={() => setRemoving(w)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {creating && <CreateDialog onClose={() => setCreating(false)} />}
      {renaming && <RenameDialog workspace={renaming} onClose={() => setRenaming(null)} />}
      {removing && <DeleteDialog workspace={removing} onClose={() => setRemoving(null)} />}
    </div>
  )
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { workspaces } = useWorkspace()
  const [name, setName] = useState('')

  const create = useMutation({
    mutationFn: () => api.post('/workspaces', { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      onClose()
    },
  })

  // 空间名没有唯一约束，重名不拦，但得提醒——切换器里两个同名空间根本分不出来
  const duplicate = workspaces.some((w) => w.name.trim() === name.trim())

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>新建工作空间</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>空间名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} autoFocus />
          </div>
          {duplicate && !!name.trim() && (
            <p className="text-xs text-amber-600">已有同名空间，切换时会分不清，建议换个名字。</p>
          )}
          <p className="text-xs text-muted-foreground">建好后你自动成为该空间的管理员。</p>
          {create.isError && <p className="text-sm text-destructive">{errorText(create.error)}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            {create.isPending ? '创建中…' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RenameDialog({ workspace, onClose }: { workspace: Workspace; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(workspace.name)

  const rename = useMutation({
    mutationFn: () => api.patch(`/workspaces/${workspace.id}`, { name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>重命名工作空间</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>空间名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} autoFocus />
          </div>
          {rename.isError && <p className="text-sm text-destructive">{errorText(rename.error)}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={() => rename.mutate()}
            disabled={!name.trim() || name.trim() === workspace.name || rename.isPending}
          >
            {rename.isPending ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({ workspace, onClose }: { workspace: Workspace; onClose: () => void }) {
  const qc = useQueryClient()

  const remove = useMutation({
    mutationFn: () => api.delete(`/workspaces/${workspace.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>删除工作空间</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <p>确定删除「{workspace.name}」？{workspace.memberCount} 条成员关系会一并消失。</p>
          <p className="text-xs text-muted-foreground">
            空间下还有账号、作品、评论等数据，或还有能用的 MCP 密钥时会被拒绝，需要先迁走或吊销。
          </p>
          {remove.isError && <p className="text-destructive">{errorText(remove.error)}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {remove.isPending ? '删除中…' : '确定删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function errorText(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string | string[] } | undefined)?.message
    if (Array.isArray(msg)) return msg.join('；')
    if (msg) return msg
  }
  return '操作失败，请重试。'
}
