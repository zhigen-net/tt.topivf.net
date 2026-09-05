import { Injectable, Logger } from '@nestjs/common'
import { PlatformAdapter, PostResult, AccountStats, PostMetrics } from '../platform.adapter'
import { graphGet, graphPost, graphUpload, GraphError } from './graph-api'
import type { Account } from '../../accounts/account.entity'
import type { Content } from '../../contents/content.entity'

export interface FacebookSession {
  pageId: string
  pageAccessToken: string
}

const VIDEO_POLL_INTERVAL_MS = 5_000
const VIDEO_POLL_MAX_ATTEMPTS = 60
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']

type VideoOutcome = 'ready' | 'failed' | 'timeout' | 'unverified'

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
        return { success: true, postId: res.id, postUrl: postLink(res.id) }
      }

      switch (content.type) {
        case 'image':
          return await this.publishPhoto(pageId, pageAccessToken, content.fileUrl, message)
        case 'video':
          return await this.publishVideo(pageId, pageAccessToken, content.fileUrl, message)
        case 'reel':
          return await this.publishReel(pageId, pageAccessToken, content.fileUrl, message)
        case 'story':
          return await this.publishStory(pageId, pageAccessToken, content.fileUrl)
        default:
          return { success: false, error: `不支持的内容类型: ${content.type}` }
      }
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

  /**
   * 互动数走贴文本体的 summary，曝光数只能走 insights。后者对 Reel、快拍这些
   * 非普通贴文经常直接报错，所以拆成两次请求：拿不到曝光不影响其余三个数。
   */
  async fetchPostMetrics(account: Account, platformPostId: string): Promise<PostMetrics | null> {
    const session = readSession(account)
    if (!session) return null
    const token = session.pageAccessToken

    try {
      const res = await graphGet<{
        likes?: { summary?: { total_count?: number } }
        comments?: { summary?: { total_count?: number } }
        shares?: { count?: number }
      }>(
        `/${platformPostId}`,
        { fields: 'likes.summary(true),comments.summary(true),shares' },
        token,
      )

      // 真的是 0 会带回 likes.summary.total_count=0；权限不够时字段整个不出现，
      // 两者都当 0 写回去就等于往库里灌假数据
      if (res.likes === undefined && res.comments === undefined && res.shares === undefined) {
        this.logger.warn(
          `Facebook 贴文 ${platformPostId} 没返回任何互动字段，多半是主页令牌缺 pages_read_engagement`,
        )
        return null
      }

      return {
        views: await this.fetchImpressions(platformPostId, token),
        likes: res.likes?.summary?.total_count ?? 0,
        comments: res.comments?.summary?.total_count ?? 0,
        shares: res.shares?.count ?? 0,
      }
    } catch (err) {
      // (#10) 在贴文被删掉时也会报，这里不区分：拿不到就是拿不到
      this.logger.warn(`拉取 Facebook 贴文指标失败 ${platformPostId}: ${err}`)
      return null
    }
  }

  private async fetchImpressions(postId: string, token: string): Promise<number> {
    try {
      const res = await graphGet<{ data?: Array<{ values?: Array<{ value?: number }> }> }>(
        `/${postId}/insights`,
        { metric: 'post_impressions' },
        token,
      )
      return res.data?.[0]?.values?.[0]?.value ?? 0
    } catch {
      return 0
    }
  }

  private async publishPhoto(
    pageId: string,
    token: string,
    fileUrl: string,
    message: string,
  ): Promise<PostResult> {
    const res = await graphPost<{ id: string; post_id?: string }>(
      `/${pageId}/photos`,
      { url: fileUrl, caption: message },
      token,
    )
    const id = res.post_id ?? res.id
    return { success: true, postId: id, postUrl: postLink(id) }
  }

  private async publishVideo(
    pageId: string,
    token: string,
    fileUrl: string,
    message: string,
  ): Promise<PostResult> {
    const res = await graphPost<{ id: string }>(
      `/${pageId}/videos`,
      { file_url: fileUrl, description: message },
      token,
      { videoHost: true },
    )
    // Facebook 收下 URL 就立刻返回，转码是异步的；不等就无法判断真的发出去了
    return this.settle(res.id, token, postLink(res.id), '视频')
  }

  /** Reels 不接受 /videos，必须走 start → rupload → finish 三段式 */
  private async publishReel(
    pageId: string,
    token: string,
    fileUrl: string,
    message: string,
  ): Promise<PostResult> {
    const start = await graphPost<{ video_id: string; upload_url: string }>(
      `/${pageId}/video_reels`,
      { upload_phase: 'start' },
      token,
    )
    await graphUpload(start.upload_url, fileUrl, token)
    const finish = await graphPost<{ post_id?: string }>(
      `/${pageId}/video_reels`,
      {
        upload_phase: 'finish',
        video_id: start.video_id,
        video_state: 'PUBLISHED',
        description: message,
      },
      token,
    )
    const id = finish.post_id ?? start.video_id
    return this.settle(start.video_id, token, reelLink(start.video_id), 'Reel', id)
  }

  /** Stories 端点不接受文案，图片和视频还是两条完全不同的链路 */
  private async publishStory(pageId: string, token: string, fileUrl: string): Promise<PostResult> {
    if (isVideoFile(fileUrl)) {
      const start = await graphPost<{ video_id: string; upload_url: string }>(
        `/${pageId}/video_stories`,
        { upload_phase: 'start' },
        token,
      )
      await graphUpload(start.upload_url, fileUrl, token)
      const finish = await graphPost<{ post_id?: string }>(
        `/${pageId}/video_stories`,
        { upload_phase: 'finish', video_id: start.video_id },
        token,
      )
      const id = finish.post_id ?? start.video_id
      return this.settle(start.video_id, token, postLink(id), '快拍', id)
    }

    // 图片快拍要先传一张未发布的照片，再用 photo_id 单独发
    const photo = await graphPost<{ id: string }>(
      `/${pageId}/photos`,
      { url: fileUrl, published: 'false' },
      token,
    )
    const story = await graphPost<{ post_id?: string }>(
      `/${pageId}/photo_stories`,
      { photo_id: photo.id },
      token,
    )
    const id = story.post_id ?? photo.id
    return { success: true, postId: id, postUrl: postLink(id) }
  }

  private async settle(
    videoId: string,
    token: string,
    url: string,
    label: string,
    postId = videoId,
  ): Promise<PostResult> {
    const outcome = await this.waitForVideo(videoId, token)
    if (outcome === 'failed') return { success: false, error: `${label}转码失败` }
    if (outcome === 'timeout') {
      return { success: false, error: `${label}已提交，但 Facebook 转码未在预期时间内完成` }
    }
    return { success: true, postId, postUrl: url }
  }

  private async waitForVideo(videoId: string, token: string): Promise<VideoOutcome> {
    for (let i = 0; i < VIDEO_POLL_MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS))
      try {
        const res = await graphGet<{ status?: { video_status?: string } }>(
          `/${videoId}`,
          { fields: 'status' },
          token,
        )
        const state = res.status?.video_status
        if (state === 'ready') return 'ready'
        if (state === 'error') return 'failed'
      } catch (err) {
        // 缺读权限时轮询永远不会成功，硬等满 5 分钟只会把任务卡死
        if (err instanceof GraphError && (err.isAuthError || err.isPermissionError)) {
          this.logger.warn(`无法读取 ${videoId} 的转码状态（凭证缺少读权限），跳过确认`)
          return 'unverified'
        }
        this.logger.warn(`video status poll failed for ${videoId}: ${err}`)
      }
    }
    return 'timeout'
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

function postLink(postId: string): string {
  return `https://www.facebook.com/${postId}`
}

function reelLink(videoId: string): string {
  return `https://www.facebook.com/reel/${videoId}`
}

function isVideoFile(fileUrl: string): boolean {
  const path = fileUrl.split(/[?#]/)[0].toLowerCase()
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext))
}
