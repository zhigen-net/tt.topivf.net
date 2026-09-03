import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { getWorkspaceId, setWorkspaceId } from './workspace-id'
import type { Workspace, WorkspaceRole } from '@/types'

const RANK: Record<WorkspaceRole, number> = { viewer: 1, member: 2, manager: 3 }

export function useWorkspace() {
  const qc = useQueryClient()
  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<Workspace[]>('/workspaces').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const list = workspaces ?? []
  const stored = getWorkspaceId()
  // 存的那个被删了或人被移出去了，就退回第一个还看得见的空间
  const current = list.find((w) => w.id === stored) ?? list[0]

  useEffect(() => {
    if (current && current.id !== stored) setWorkspaceId(current.id)
  }, [current, stored])

  function switchTo(id: string) {
    if (id === current?.id) return
    setWorkspaceId(id)
    // 每份缓存都属于某个空间，整体清掉比给几十个 queryKey 挨个补空间更不容易漏
    qc.clear()
  }

  const role = current?.role
  return {
    workspace: current,
    workspaces: list,
    role,
    isManager: role === 'manager',
    can: (required: WorkspaceRole) => !!role && RANK[role] >= RANK[required],
    isLoading,
    switchTo,
  }
}
