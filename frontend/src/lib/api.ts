import axios from 'axios'
import { getWorkspaceId } from './workspace-id'

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // 不带这个头时后端会退回到第一个可见空间，和前端的默认选择是一致的
  const workspaceId = getWorkspaceId()
  if (workspaceId) config.headers['X-Workspace-Id'] = workspaceId
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)
