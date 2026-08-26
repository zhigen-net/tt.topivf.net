import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Content } from './content.entity'
import { ContentsController } from './contents.controller'
import { ContentsService } from './contents.service'

@Module({
  imports: [TypeOrmModule.forFeature([Content])],
  controllers: [ContentsController],
  providers: [ContentsService],
  exports: [ContentsService],
})
export class ContentsModule {}
