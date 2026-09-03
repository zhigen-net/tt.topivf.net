import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm'
import { Exclude } from 'class-transformer'
import { Proxy } from '../proxies/proxy.entity'

export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook'
export type AccountStatus = 'active' | 'inactive' | 'banned' | 'warming'

@Entity('accounts')
@Index(['workspaceId'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId?: string

  @Column({ type: 'enum', enum: ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook'] })
  platform: Platform

  @Column({ unique: false })
  username: string

  @Column({ name: 'display_name' })
  displayName: string

  @Column({ nullable: true })
  avatar?: string

  @Column({ type: 'enum', enum: ['active', 'inactive', 'banned', 'warming'], default: 'inactive' })
  status: AccountStatus

  @Column({ name: 'group_id', nullable: true })
  groupId?: string

  @Column({ name: 'proxy_id', nullable: true })
  proxyId?: string

  @ManyToOne(() => Proxy, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'proxy_id' })
  proxy?: Proxy

  @Column({ default: 0 })
  followers: number

  @Column({ default: 0 })
  following: number

  @Column({ name: 'posts_count', default: 0 })
  postsCount: number

  // cookie / access token 等同密码，任何响应都不该带出去
  @Exclude()
  @Column({ name: 'session_data', type: 'jsonb', nullable: true })
  sessionData?: Record<string, unknown>

  @Column({ name: 'last_active_at', nullable: true })
  lastActiveAt?: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
