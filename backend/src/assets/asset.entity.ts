import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm'

export type AssetType = 'video' | 'image'

@Entity('assets')
@Index(['workspaceId'])
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string

  // MinIO 对象键，形如 ${workspaceId}/${uuid}.mp4；带空间前缀，误配也不会跨空间串
  @Column({ name: 'object_key', unique: true })
  objectKey: string

  @Column()
  filename: string

  @Column({ name: 'mime_type' })
  mimeType: string

  @Column({ type: 'bigint' })
  size: number

  @Column({ type: 'enum', enum: ['video', 'image'] })
  type: AssetType

  @Column({ nullable: true })
  duration?: number

  /**
   * 缩略图对象键。只有图片才有；生成失败或历史素材没回填时为空，
   * 取用方要自己退回原图，不能假定它一定在。
   */
  @Column({ name: 'thumb_key', type: 'varchar', nullable: true })
  thumbKey?: string | null

  @Column({ name: 'uploaded_by_id', type: 'uuid', nullable: true })
  uploadedById?: string

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy?: string

  /**
   * 分享链接的令牌。页面上那种带 HMAC 的签名直链是自包含的，签出去就撤不回来，
   * 只能靠十分钟的短命期兜底；分享链接要活几十天，必须能随时作废，所以落库。
   */
  @Column({ name: 'share_token', type: 'varchar', nullable: true })
  shareToken?: string | null

  @Column({ name: 'share_expires_at', type: 'timestamp', nullable: true })
  shareExpiresAt?: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
