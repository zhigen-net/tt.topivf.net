import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './user.entity'
import { UsersService } from './users.service'
import { UsersController } from './users.controller'
import { Workspace } from '../workspaces/workspace.entity'
import { WorkspaceMember } from '../workspaces/workspace-member.entity'

@Module({
  // 建号时要顺手建空间/写成员关系，但不能 import WorkspacesModule——它已经依赖本模块
  imports: [TypeOrmModule.forFeature([User, Workspace, WorkspaceMember])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
