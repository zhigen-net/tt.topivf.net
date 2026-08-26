import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'
import type { Platform } from '../accounts/account.entity'

@Entity('stats_snapshots')
export class StatsSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'account_id' })
  accountId: string

  @Column({ type: 'enum', enum: ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook'] })
  platform: Platform

  @Column({ default: 0 })
  followers: number

  @Column({ default: 0 })
  following: number

  @Column({ default: 0 })
  likes: number

  @Column({ default: 0 })
  views: number

  @Column({ default: 0 })
  comments: number

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date
}
