import type { TaskStatus } from '@/types'

export const taskStatusVariant: Record<TaskStatus, 'default' | 'success' | 'destructive' | 'secondary'> = {
  pending: 'secondary',
  running: 'default',
  done: 'success',
  failed: 'destructive',
}

export const taskStatusLabel: Record<TaskStatus, string> = {
  pending: '待执行',
  running: '执行中',
  done: '已完成',
  failed: '失败',
}
