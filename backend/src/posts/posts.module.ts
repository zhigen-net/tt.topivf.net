import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Post } from './post.entity'
import { PostsService } from './posts.service'
import { PostsController } from './posts.controller'
import { Account } from '../accounts/account.entity'
import { Content } from '../contents/content.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Post, Account, Content])],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
