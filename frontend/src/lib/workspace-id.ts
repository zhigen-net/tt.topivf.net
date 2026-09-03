// 单独一个文件是为了让 api.ts 不用反过来依赖 workspace.ts（后者要用 api 发请求）
const STORAGE_KEY = 'workspaceId'

export const getWorkspaceId = () => localStorage.getItem(STORAGE_KEY)
export const setWorkspaceId = (id: string) => localStorage.setItem(STORAGE_KEY, id)
