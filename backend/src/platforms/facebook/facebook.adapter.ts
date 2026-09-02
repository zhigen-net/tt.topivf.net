import { Injectable, Logger } from '@nestjs/common'
import { PlatformAdapter, PostResult, AccountStats } from '../platform.adapter'
import { graphGet, graphPost, GraphError } from './graph-api'
import type { Account } from '../../accounts/account.entity'
import type { Content } from '../../contents/content.entity'

export interface FacebookSession {
  pageId: string
  pageAccessToken: string
}

const VIDEO_POLL_INTERVAL_MS = 5_000
const VIDEO_POLL_MAX_ATTEMPTS = 60

@Injectable()
export class FacebookAdapter extends PlatformAdapter {
  readonly platform = 'facebook'
  private readonly logger = new Logger(FacebookAdapter.name)

  async publish(account: Account, content: Content): Promise<PostResult> {
    const session = readSession(account)
    if (!session) return { success: false, error: '主页未授权，请先绑定 Facebook 主页' }

    const { pageId, pageAccessToken } = session
    const message = buildMessage(content)

    try {
      if (!content.fileUrl) {
        const res = await graphPost<{ id: string }>(`/${pageId}/feed`, { message }, pageAccessToken)
        return { success: true, postId: res.id, postUrl: permalink(res.id) }
      }

      if (content.type === 'image') {
        const res = await graphPost<{ id: string; post_id?: string }>(
          `/${pageId}/photos`,
          { url: content.fileUrl, caption: message },
          pageAccessToken,
        )
        const id = res.post_id ?? res.id
        return { success: true, postId: id, postUrl: permalink(id) }
      }

      if (content.type === 'video' || content.type === 'reel' || content.type === 'story') {
        const res = await graphPost<{ id: string }>(
          `/${pageId}/videos`,
          { file_url: content.fileUrl, description: message },
          pageAccessToken,
          { videoHost: true },
        )
        // Facebook 收下 URL 就立刻返回，转码是异步的；不等就无法判断真的发出去了
        const ready = await this.waitForVideo(res.id, pageAccessToken)
        if (!ready) return { success: false, error: '视频已提交，但 Facebook 转码未在预期时间内完成' }
        return { success: true, postId: res.id, postUrl: permalink(res.id) }
      }

      return { success: false, error: `不支持的内容类型: ${content.type}` }
    } catch (err) {
      const msg = err instanceof GraphError ? `[${err.code}] ${err.message}` : String(err)
      this.logger.error(`Facebook publish failed for ${account.username}: ${msg}`)
      return { success: false, error: msg }
    }
  }

  async fetchStats(account: Account): Promise<AccountStats> {
    const session = readSession(account)
    const fallback = {
      followers: account.followers,
      following: account.following,
      postsCount: account.postsCount,
    }
    if (!session) return fallback

    try {
      const [page, posts] = await Promise.all([
        graphGet<{ followers_count?: number; fan_count?: number }>(
          `/${session.pageId}`,
          { fields: 'followers_count,fan_count' },
          session.pageAccessToken,
        ),
        // /posts 和 /feed 都不支持 summary，只有 /published_posts 支持
        graphGet<{ summary?: { total_count?: number } }>(
          `/${session.pageId}/published_posts`,
          { summary: 'total_count', limit: '0' },
          session.pageAccessToken,
        ),
      ])

      return {
        followers: page.followers_count ?? page.fan_count ?? fallback.followers,
        following: 0,
        postsCount: posts.summary?.total_count ?? fallback.postsCount,
      }
    } catch (err) {
      this.logger.warn(`fetchStats failed for ${account.username}: ${err}`)
      return fallback
    }
  }

  async checkHealth(account: Account): Promise<boolean> {
    const session = readSession(account)
    if (!session) return false

    try {
      const page = await graphGet<{ id: string }>(
        `/${session.pageId}`,
        { fields: 'id' },
        session.pageAccessToken,
      )
      return page.id === session.pageId
    } catch (err) {
      // 限流只是暂时的，据此判失效会把好账号误标成"授权已失效"
      if (err instanceof GraphError && err.isRateLimit) {
        this.logger.warn(`checkHealth rate limited for ${account.username}, keeping current status`)
        return account.status === 'active'
      }
      this.logger.warn(`checkHealth failed for ${account.username}: ${err}`)
      return false
    }
  }

  private async waitForVideo(videoId: string, token: string): Promise<boolean> {
    for (let i = 0; i < VIDEO_POLL_MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS))
      try {
        const res = await graphGet<{ status?: { video_status?: string } }>(
          `/${videoId}`,
          { fields: 'status' },
          token,
        )
        const state = res.status?.video_status
        if (state === 'ready') return true
        if (state === 'error') return false
      } catch (err) {
        this.logger.warn(`video status poll failed for ${videoId}: ${err}`)
      }
    }
    return false
  }
}

export function readSession(account: Account): FacebookSession | null {
  const pageId = account.sessionData?.pageId
  const pageAccessToken = account.sessionData?.pageAccessToken
  if (typeof pageId !== 'string' || typeof pageAccessToken !== 'string') return null
  return { pageId, pageAccessToken }
}

function buildMessage(content: Content): string {
  const tags = content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
  return [content.caption, tags].filter(Boolean).join('\n\n')
}

function permalink(postId: string): string {
  return `https://www.facebook.com/${postId}`
}
