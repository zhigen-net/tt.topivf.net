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

  @Column({ name: 'uploaded_by_id', type: 'uuid', nullable: true })
  uploadedById?: string

  @Column({ name: 'uploaded_by', nullable: true })
  uploadedBy?: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
