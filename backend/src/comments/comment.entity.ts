import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique,
} from 'typeorm'
import { PLATFORMS, type Platform } from '../accounts/account.entity'

/**
 * 平台侧的一条评论。我们自己发出去的回复也存成一行（fromPage = true），
 * 这样在平台 App 里手工回的复也能被同步回来，不会让收件箱一直显示「待回复」。
 */
@Entity('comments')
@Index(['workspaceId'])
@Index(['accountId'])
@Unique(['accountId', 'platformCommentId'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId?: string

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string

  @Column({ type: 'enum', enum: [...PLATFORMS] })
  platform: Platform

  @Column({ name: 'platform_comment_id' })
  platformCommentId: string

  /** 评论挂在哪条贴文下。可能是 SocialHub 发的，也可能是平台上原有的 */
  @Column({ name: 'platform_post_id' })
  platformPostId: string

  /** 平台侧的父评论 id，顶层评论为空 */
  @Column({ name: 'parent_comment_id', type: 'varchar', nullable: true })
  parentCommentId?: string | null

  @Column({ name: 'author_id', type: 'varchar', nullable: true })
  authorId?: string | null

  @Column({ name: 'author_name', type: 'varchar', nullable: true })
  authorName?: string | null

  @Column({ type: 'text', default: '' })
  message: string

  /** 这条是账号自己发的（我们的回复，或在平台 App 里手工回的） */
  @Column({ name: 'from_page', default: false })
  fromPage: boolean

  /** 平台侧的发表时间，不是入库时间 */
  @Column({ name: 'posted_at', type: 'timestamp' })
  postedAt: Date

  /** 已有账号侧的回复挂在它下面。同步时按子评论回填，手工回的也能认出来 */
  @Column({ name: 'replied_at', type: 'timestamp', nullable: true })
  repliedAt?: Date | null

  /** 人工标记「不用管」，从待处理列表里移出去 */
  @Column({ name: 'ignored_at', type: 'timestamp', nullable: true })
  ignoredAt?: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
