import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm'
import { PLATFORMS, type Platform } from '../accounts/account.entity'

/**
 * 一条作品在某个账号上的发布结果。发布任务的 results 是 jsonb 数组，没法索引也没法
 * 按平台 id 查，而数据要被反复 UPDATE，所以单独拉一张表出来承接。
 */
@Entity('posts')
@Index(['workspaceId'])
@Index(['accountId'])
@Index(['contentId'])
@Unique(['accountId', 'platformPostId'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId?: string

  @Column({ name: 'content_id', type: 'uuid' })
  contentId: string

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string

  @Column({ type: 'enum', enum: [...PLATFORMS] })
  platform: Platform

  /** 平台侧的作品 id，拉数据全靠它 */
  @Column({ name: 'platform_post_id' })
  platformPostId: string

  @Column({ name: 'post_url', nullable: true })
  postUrl?: string

  @Column({ name: 'published_at' })
  publishedAt: Date

  @Column({ default: 0 })
  views: number

  @Column({ default: 0 })
  likes: number

  @Column({ default: 0 })
  comments: number

  @Column({ default: 0 })
  shares: number

  /** 没拉过数据时为空，调度器按它挑该刷哪些 */
  @Column({ name: 'metrics_updated_at', nullable: true })
  metricsUpdatedAt?: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
