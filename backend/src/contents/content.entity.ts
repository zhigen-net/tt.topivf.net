import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import type { Platform } from '../accounts/account.entity'

export type ContentType = 'video' | 'image' | 'reel' | 'story'

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
