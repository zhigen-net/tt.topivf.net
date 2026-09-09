import { useSyncExternalStore } from 'react'

// 单独一个文件是为了让 api.ts 不用反过来依赖 workspace.ts（后者要用 api 发请求）
const STORAGE_KEY = 'workspaceId'

const listeners = new Set<() => void>()

export const getWorkspaceId = () => localStorage.getItem(STORAGE_KEY)

export function setWorkspaceId(id: string) {
  if (localStorage.getItem(STORAGE_KEY) === id) return
  localStorage.setItem(STORAGE_KEY, id)
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

/** localStorage 不是响应式的，切换空间要靠这里把变化推给 React，否则界面不会动 */
export function useWorkspaceId() {
  return useSyncExternalStore(subscribe, getWorkspaceId)
}
