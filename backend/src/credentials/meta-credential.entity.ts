import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm'
import { Exclude } from 'class-transformer'

/** expiring 只是提醒，此时凭证还能用；invalid 才是真的发不出去了 */
export type CredentialStatus = 'active' | 'expiring' | 'invalid'

export const CREDENTIAL_STATUSES: CredentialStatus[] = ['active', 'expiring', 'invalid']

/**
 * 一条 Meta 授权源。它派生出来的主页凭证分散在各个 account 的 sessionData 里，
 * 这张表让「这批账号来自同一条令牌」这件事变得可查，换令牌时才能批量刷新。
 */
@Entity('meta_credentials')
@Index(['workspaceId'])
export class MetaCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string

  @Column()
  label: string

  @Column({ name: 'app_id', default: '' })
  appId: string

  /** SYSTEM_USER 永不过期，USER 是 60 天一续 */
  @Column({ name: 'token_type', default: 'UNKNOWN' })
  tokenType: string

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  scopes: string[]

  /**
   * unix 秒，0 表示永不过期。bigint 在 pg 驱动里读出来是字符串，而 "0" 是 truthy，
   * 不转成数字会把永不过期的系统用户令牌判成已过期。
   */
  @Column({
    name: 'expires_at',
    type: 'bigint',
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string | number | null) => Number(v ?? 0) },
  })
  expiresAt: number

  // 源令牌权限远高于单个主页凭证，泄露等于整个商务管理平台失守
  @Exclude()
  @Column({ name: 'encrypted_token', type: 'text' })
  encryptedToken: string

  @Column({ type: 'enum', enum: CREDENTIAL_STATUSES, default: 'active' })
  status: CredentialStatus

  @Column({ name: 'last_checked_at', type: 'timestamp', nullable: true })
  lastCheckedAt?: Date

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string

  /** 巡检发现的、还没接入成账号的主页/IG，供前端提示「有新主页可接入」 */
  @Column({ name: 'pending_targets', type: 'jsonb', default: () => "'[]'" })
  pendingTargets: PendingTarget[]

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}

export interface PendingTarget {
  platform: 'facebook' | 'instagram'
  /** facebook 是 pageId，instagram 是 igUserId */
  externalId: string
  username: string
  displayName: string
  avatar?: string
}
