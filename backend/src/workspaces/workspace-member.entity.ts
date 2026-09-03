import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Unique, Index,
} from 'typeorm'
import { User } from '../users/user.entity'
import { Workspace } from './workspace.entity'

/** manager 管治理与删除，member 做日常创作/审核/发布，viewer 只读 */
export type WorkspaceRole = 'manager' | 'member' | 'viewer'

export const WORKSPACE_ROLES: WorkspaceRole[] = ['manager', 'member', 'viewer']

@Entity('workspace_members')
@Unique(['workspaceId', 'userId'])
@Index(['userId'])
export class WorkspaceMember {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: Workspace

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User

  @Column({ type: 'enum', enum: WORKSPACE_ROLES, default: 'member' })
  role: WorkspaceRole

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date
}
