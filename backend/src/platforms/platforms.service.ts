import { Injectable } from '@nestjs/common'
import { PlatformAdapter } from './platform.adapter'
import { TiktokAdapter } from './tiktok/tiktok.adapter'
import { InstagramAdapter } from './instagram/instagram.adapter'
import { YoutubeAdapter } from './youtube/youtube.adapter'
import { TwitterAdapter } from './twitter/twitter.adapter'
import { FacebookAdapter } from './facebook/facebook.adapter'

@Injectable()
export class PlatformsService {
  private readonly adapters = new Map<string, PlatformAdapter>()

  constructor(
    tiktok: TiktokAdapter,
    instagram: InstagramAdapter,
    youtube: YoutubeAdapter,
    twitter: TwitterAdapter,
    facebook: FacebookAdapter,
  ) {
    this.adapters.set('tiktok', tiktok)
    this.adapters.set('instagram', instagram)
    this.adapters.set('youtube', youtube)
    this.adapters.set('twitter', twitter)
    this.adapters.set('facebook', facebook)
  }

  getAdapter(platform: string): PlatformAdapter | undefined {
    return this.adapters.get(platform)
  }
}
