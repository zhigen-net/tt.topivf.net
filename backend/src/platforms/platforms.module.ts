import { Global, Module } from '@nestjs/common'
import { BrowserManager } from './browser-manager.service'
import { TiktokAdapter } from './tiktok/tiktok.adapter'
import { TiktokLoginService } from './tiktok/tiktok-login.service'
import { TiktokLoginController } from './tiktok/tiktok-login.controller'
import { InstagramAdapter } from './instagram/instagram.adapter'
import { YoutubeAdapter } from './youtube/youtube.adapter'
import { TwitterAdapter } from './twitter/twitter.adapter'
import { FacebookAdapter } from './facebook/facebook.adapter'
import { FacebookService } from './facebook/facebook.service'
import { FacebookController } from './facebook/facebook.controller'
import { PlatformsService } from './platforms.service'

@Global()
@Module({
  controllers: [TiktokLoginController, FacebookController],
  providers: [
    BrowserManager,
    TiktokAdapter,
    TiktokLoginService,
    InstagramAdapter,
    YoutubeAdapter,
    TwitterAdapter,
    FacebookAdapter,
    FacebookService,
    PlatformsService,
  ],
  exports: [PlatformsService, BrowserManager],
})
export class PlatformsModule {}
