import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { setWorkspaceId, useWorkspaceId } from './workspace-id'
import type { Workspace, WorkspaceRole } from '@/types'

const RANK: Record<WorkspaceRole, number> = { viewer: 1, member: 2, manager: 3 }

export function useWorkspace() {
  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<Workspace[]>('/workspaces').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const list = workspaces ?? []
  const stored = useWorkspaceId()
  // 存的那个被删了或人被移出去了，就退回第一个还看得见的空间
  const current = list.find((w) => w.id === stored) ?? list[0]

  useEffect(() => {
    if (current && current.id !== stored) setWorkspaceId(current.id)
  }, [current, stored])

  // 缓存按空间分桶（见 App.tsx 的 queryKeyHashFn），所以这里不必再清缓存
  const switchTo = setWorkspaceId

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
