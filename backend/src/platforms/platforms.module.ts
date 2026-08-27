import { Global, Module } from '@nestjs/common'
import { BrowserManager } from './browser-manager.service'
import { TiktokAdapter } from './tiktok/tiktok.adapter'
import { TiktokLoginService } from './tiktok/tiktok-login.service'
import { TiktokLoginController } from './tiktok/tiktok-login.controller'
import { InstagramAdapter } from './instagram/instagram.adapter'
import { YoutubeAdapter } from './youtube/youtube.adapter'
import { TwitterAdapter } from './twitter/twitter.adapter'
import { FacebookAdapter } from './facebook/facebook.adapter'
import { PlatformsService } from './platforms.service'

@Global()
@Module({
  controllers: [TiktokLoginController],
  providers: [
    BrowserManager,
    TiktokAdapter,
    TiktokLoginService,
    InstagramAdapter,
    YoutubeAdapter,
    TwitterAdapter,
    FacebookAdapter,
    PlatformsService,
  ],
  exports: [PlatformsService, BrowserManager],
})
export class PlatformsModule {}
