import { Module } from '@nestjs/common'
import { BrowserManager } from './browser-manager.service'
import { TiktokAdapter } from './tiktok/tiktok.adapter'
import { InstagramAdapter } from './instagram/instagram.adapter'
import { YoutubeAdapter } from './youtube/youtube.adapter'
import { TwitterAdapter } from './twitter/twitter.adapter'
import { FacebookAdapter } from './facebook/facebook.adapter'
import { PlatformsService } from './platforms.service'

@Module({
  providers: [
    BrowserManager,
    TiktokAdapter,
    InstagramAdapter,
    YoutubeAdapter,
    TwitterAdapter,
    FacebookAdapter,
    PlatformsService,
  ],
  exports: [PlatformsService, BrowserManager],
})
export class PlatformsModule {}
