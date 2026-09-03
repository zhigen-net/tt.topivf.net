import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Content } from './content.entity'
import { Asset } from '../assets/asset.entity'
import { AssetsModule } from '../assets/assets.module'
import { PublishTask } from '../tasks/publish-task.entity'
import { ContentsController } from './contents.controller'
import { ContentsService } from './contents.service'

@Module({
  imports: [TypeOrmModule.forFeature([Content, PublishTask, Asset]), AssetsModule],
  controllers: [ContentsController],
  providers: [ContentsService],
  exports: [ContentsService],
})
export class ContentsModule {}
