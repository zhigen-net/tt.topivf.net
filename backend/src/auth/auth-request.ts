import type { Request } from 'express'
import type { User } from '../users/user.entity'
import type { ApiKey } from './api-key.entity'

/** apiKey 只在走 sh_ 密钥认证时存在；走 JWT 时为 undefined */
export type AuthRequest = Request & { user?: User; apiKey?: ApiKey }
