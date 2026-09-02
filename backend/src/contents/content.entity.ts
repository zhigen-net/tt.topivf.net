import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import type { Platform } from '../accounts/account.entity'

export type ContentType = 'video' | 'image' | 'reel' | 'story'

/** 草稿 → 待审核 → 已通过 / 已驳回；内容被改动会退回草稿 */
export type ReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected'

@Entity('contents')
export class Content {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  title: string

  @Column({ type: 'enum', enum: ['video', 'image', 'reel', 'story'] })
  type: ContentType

  @Column({ name: 'file_url', nullable: true })
  fileUrl?: string

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl?: string

  @Column({ type: 'text', nullable: true })
  caption?: string

  @Column({ type: 'text', array: true, default: [] })
  hashtags: string[]

  @Column({ type: 'text', array: true, default: [] })
  platforms: Platform[]

  @Column({ nullable: true })
  size?: number

  @Column({ nullable: true })
  duration?: number

  @Column({
    name: 'review_status',
    type: 'enum',
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft',
  })
  reviewStatus: ReviewStatus

  /** 驳回理由 */
  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote?: string

  @Column({ name: 'reviewed_at', nullable: true })
  reviewedAt?: Date

  // 存名字快照而不是关联：审核记录要在用户被改名或删除后仍然读得懂
  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy?: string

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById?: string

  @Column({ name: 'created_by', nullable: true })
  createdBy?: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
