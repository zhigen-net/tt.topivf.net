import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm'
import { Exclude } from 'class-transformer'

@Entity('proxies')
@Index(['workspaceId'])
export class Proxy {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId?: string

  @Column()
  host: string

  @Column()
  port: number

  @Column({ type: 'enum', enum: ['http', 'socks5'], default: 'http' })
  protocol: 'http' | 'socks5'

  @Column({ nullable: true })
  username?: string

  @Exclude()
  @Column({ nullable: true })
  password?: string

  @Column({ nullable: true })
  label?: string

  @Column({ nullable: true })
  country?: string

  @Column({ name: 'is_healthy', default: true })
  isHealthy: boolean

  @Column({ name: 'last_checked_at', nullable: true })
  lastCheckedAt?: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
