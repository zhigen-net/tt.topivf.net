import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Account } from '../accounts/account.entity'
import { BrowserManager } from './browser-manager.service'
import { TiktokAdapter } from './tiktok/tiktok.adapter'
import { TiktokApiAdapter } from './tiktok/tiktok-api.adapter'
import { TiktokBrowserAdapter } from './tiktok/tiktok-browser.adapter'
import { TiktokTokenService } from './tiktok/tiktok-token.service'
import { TiktokOauthService } from './tiktok/tiktok-oauth.service'
import { TiktokOauthController } from './tiktok/tiktok-oauth.controller'
import { TiktokLoginService } from './tiktok/tiktok-login.service'
import { TiktokLoginController } from './tiktok/tiktok-login.controller'
// Instagram 走官方 Graph API，不需要 BrowserManager
import { InstagramAdapter } from './instagram/instagram.adapter'
import { YoutubeAdapter } from './youtube/youtube.adapter'
import { TwitterAdapter } from './twitter/twitter.adapter'
import { FacebookAdapter } from './facebook/facebook.adapter'
import { FacebookService } from './facebook/facebook.service'
import { FacebookController } from './facebook/facebook.controller'
import { PlatformsService } from './platforms.service'

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Account])],
  controllers: [TiktokOauthController, TiktokLoginController, FacebookController],
  providers: [
    BrowserManager,
    TiktokAdapter,
    TiktokApiAdapter,
    TiktokBrowserAdapter,
    TiktokTokenService,
    TiktokOauthService,
    TiktokLoginService,
    InstagramAdapter,
    YoutubeAdapter,
    TwitterAdapter,
    FacebookAdapter,
    FacebookService,
    PlatformsService,
  ],
  exports: [PlatformsService, BrowserManager, FacebookService],
})
export class PlatformsModule {}
