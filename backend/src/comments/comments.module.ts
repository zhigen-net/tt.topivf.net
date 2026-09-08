import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Comment } from './comment.entity'
import { CommentsService } from './comments.service'
import { CommentsController } from './comments.controller'
import { CommentsScheduler } from './comments.scheduler'
import { Account } from '../accounts/account.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Account])],
  controllers: [CommentsController],
  providers: [CommentsService, CommentsScheduler],
  exports: [CommentsService],
})
export class CommentsModule {}
