import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

/** 全站唯一一行配置，id 恒为 SINGLETON_ID，不是 uuid 也不该有第二行 */
@Entity('system_settings')
export class SystemSetting {
  @PrimaryColumn({ type: 'int' })
  id: number

  @Column({ name: 'site_name', length: 32 })
  siteName: string

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
