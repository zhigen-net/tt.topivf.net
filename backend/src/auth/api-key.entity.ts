import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm'
import { Exclude } from 'class-transformer'
import { User } from '../users/user.entity'

export const MCP_SCOPES = [
  'contents:read',
  'contents:write',
  'contents:review',
  'accounts:read',
  'tasks:read',
  'tasks:publish',
  'analytics:read',
] as const

export type McpScope = (typeof MCP_SCOPES)[number]

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  // 明文只在创建时回显一次，之后靠 prefix 定位记录、再比对 secret 的哈希
  @Column({ unique: true })
  prefix: string

  @Exclude()
  @Column({ name: 'secret_hash' })
  secretHash: string

  @Column({ name: 'user_id' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User

  @Column({ type: 'jsonb', default: () => `'[]'` })
  scopes: McpScope[]

  // null 表示不限账号；空数组表示一个账号都碰不到
  @Column({ name: 'account_ids', type: 'jsonb', nullable: true })
  accountIds?: string[] | null

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date | null

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt?: Date | null

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt?: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
