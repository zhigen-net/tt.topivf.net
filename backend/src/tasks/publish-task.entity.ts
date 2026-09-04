import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm'
import { Content } from '../contents/content.entity'
import type { Platform } from '../accounts/account.entity'

export type TaskStatus = 'pending' | 'running' | 'done' | 'failed'

export interface TaskResult {
  accountId: string
  platform: Platform
  success: boolean
  /** 平台侧的作品 id，posts 表靠它拉数据 */
  postId?: string
  postUrl?: string
  error?: string
}

@Entity('publish_tasks')
@Index(['workspaceId'])
export class PublishTask {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId?: string

  @Column({ name: 'content_id' })
  contentId: string

  @ManyToOne(() => Content, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content

  @Column({ name: 'account_ids', type: 'text', array: true })
  accountIds: string[]

  @Column({ type: 'text', array: true })
  platforms: Platform[]

  @Column({ type: 'enum', enum: ['pending', 'running', 'done', 'failed'], default: 'pending' })
  status: TaskStatus

  @Column({ name: 'scheduled_at' })
  scheduledAt: Date

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date

  @Column({ type: 'jsonb', default: [] })
  results: TaskResult[]

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
