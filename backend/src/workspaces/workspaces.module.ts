import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Workspace } from './workspace.entity'
import { WorkspaceMember } from './workspace-member.entity'
import { WorkspacesService } from './workspaces.service'
import { WorkspacesController } from './workspaces.controller'
import { WorkspaceBootstrapService } from './workspace-bootstrap.service'
import { WorkspaceGuard } from './workspace.guard'
import { User } from '../users/user.entity'
import { UsersModule } from '../users/users.module'

@Module({
  imports: [TypeOrmModule.forFeature([Workspace, WorkspaceMember, User]), UsersModule],
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    WorkspaceBootstrapService,
    // 排在 AuthModule 的两个守卫之后：那时 req.user / req.apiKey 才已就位
    { provide: APP_GUARD, useClass: WorkspaceGuard },
  ],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
