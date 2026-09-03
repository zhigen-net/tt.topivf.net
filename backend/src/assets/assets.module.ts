import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Asset } from './asset.entity'
import { AssetsController } from './assets.controller'
import { AssetsService } from './assets.service'
import { AssetStorageService } from './asset-storage.service'
import { Content } from '../contents/content.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Asset, Content])],
  controllers: [AssetsController],
  providers: [AssetsService, AssetStorageService],
  exports: [AssetsService],
})
export class AssetsModule {}
