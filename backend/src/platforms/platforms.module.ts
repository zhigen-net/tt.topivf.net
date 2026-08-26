import { Module } from '@nestjs/common'
import { TiktokAdapter } from './tiktok/tiktok.adapter'
import { InstagramAdapter } from './instagram/instagram.adapter'
import { YoutubeAdapter } from './youtube/youtube.adapter'
import { TwitterAdapter } from './twitter/twitter.adapter'
import { FacebookAdapter } from './facebook/facebook.adapter'
import { PlatformsService } from './platforms.service'

@Module({
  providers: [TiktokAdapter, InstagramAdapter, YoutubeAdapter, TwitterAdapter, FacebookAdapter, PlatformsService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
