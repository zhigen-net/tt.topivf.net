import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'
import { Exclude } from 'class-transformer'

export type UserRole = 'admin' | 'user'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  username: string

  /**
   * 可选的第二登录名。用户名的字符集里没有 @，两者不会撞到一起，
   * 所以登录时同一个输入框拿去比这两列是安全的。存之前统一转小写。
   */
  @Column({ unique: true, nullable: true })
  email?: string | null

  // ClassSerializerInterceptor 靠这个把哈希挡在响应外，返回值必须保持类实例
  @Exclude()
  @Column({ name: 'password_hash' })
  passwordHash: string

  @Column({ name: 'display_name' })
  displayName: string

  @Column({ type: 'enum', enum: ['admin', 'user'], default: 'user' })
  role: UserRole

  @Column({ name: 'is_active', default: true })
  isActive: boolean

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt?: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}
