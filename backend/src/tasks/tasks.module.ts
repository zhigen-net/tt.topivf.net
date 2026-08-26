import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { PublishTask } from './publish-task.entity'
import { TasksController } from './tasks.controller'
import { TasksService } from './tasks.service'
import { TasksProcessor } from './tasks.processor'
import { AccountsModule } from '../accounts/accounts.module'
import { PlatformsModule } from '../platforms/platforms.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([PublishTask]),
    BullModule.registerQueue({ name: 'publish' }),
    AccountsModule,
    PlatformsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksProcessor],
  exports: [TasksService],
})
export class TasksModule {}
