import type { WorkspaceRole } from '@/types'

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  manager: '空间管理员',
  member: '成员',
  viewer: '只读',
}
