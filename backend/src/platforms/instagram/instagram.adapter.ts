import { Injectable, Logger } from '@nestjs/common'
import { PlatformAdapter, PostResult, AccountStats, PostMetrics } from '../platform.adapter'
import { graphGet, graphPost, GraphError } from '../facebook/graph-api'
import type { Account } from '../../accounts/account.entity'
import type { Content } from '../../contents/content.entity'

export interface InstagramSession {
  igUserId: string
  pageAccessToken: string
}

const POLL_INTERVAL_MS = 5_000
const POLL_MAX_ATTEMPTS = 60
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']

type ContainerOutcome = { ok: true } | { ok: false; error: string }

/**
 * 走官方 Instagram Graph API，不碰浏览器。凭证就是关联主页的 Page Access Token，
 * 所以这里和 FacebookAdapter 共用 graph-api 那一层。
 */
@Injectable()
export class InstagramAdapter extends PlatformAdapter {
  readonly platform = 'instagram'
  private readonly logger = new Logger(InstagramAdapter.name)

  async publish(account: Account, content: Content): Promise<PostResult> {
    const session = readSession(account)
    if (!session) {
      return { success: false, error: '账号未授权，请先绑定关联了主页的 Instagram 专业账号' }
    }
    // 发布接口没有纯文字的入口，让它走到 API 才失败只会浪费一次任务
    if (!content.fileUrl) {
      return { success: false, error: 'Instagram 不能发纯文字，作品必须带图片或视频' }
    }

    const { igUserId, pageAccessToken } = session
    try {
      const creationId = await this.createContainer(igUserId, pageAccessToken, content)
      const outcome = await this.waitForContainer(creationId, pageAccessToken)
      if (!outcome.ok) return { success: false, error: outcome.error }

      const res = await graphPost<{ id: string }>(
        `/${igUserId}/media_publish`,
        { creation_id: creationId },
        pageAccessToken,
      )
      return { success: true, postId: res.id, postUrl: await this.permalink(res.id, pageAccessToken) }
    } catch (err) {
      const msg = err instanceof GraphError ? `[${err.code}] ${err.message}` : String(err)
      this.logger.error(`Instagram publish failed for @${account.username}: ${msg}`)
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
      const res = await graphGet<{
        followers_count?: number
        follows_count?: number
        media_count?: number
      }>(
        `/${session.igUserId}`,
        { fields: 'followers_count,follows_count,media_count' },
        session.pageAccessToken,
      )
      return {
        followers: res.followers_count ?? fallback.followers,
        following: res.follows_count ?? fallback.following,
        postsCount: res.media_count ?? fallback.postsCount,
      }
    } catch (err) {
      this.logger.warn(`fetchStats failed for @${account.username}: ${err}`)
      return fallback
    }
  }

  async checkHealth(account: Account): Promise<boolean> {
    const session = readSession(account)
    if (!session) return false

    try {
      const res = await graphGet<{ id: string }>(
        `/${session.igUserId}`,
        { fields: 'id' },
        session.pageAccessToken,
      )
      return res.id === session.igUserId
    } catch (err) {
      // 限流只是暂时的，据此判失效会把好账号误标成"授权已失效"
      if (err instanceof GraphError && err.isRateLimit) {
        this.logger.warn(`checkHealth rate limited for @${account.username}, keeping current status`)
        return account.status === 'active'
      }
      this.logger.warn(`checkHealth failed for @${account.username}: ${err}`)
      return false
    }
  }

  /**
   * 点赞和评论是 media 上的普通字段，播放量只能走 insights，而 insights 对
   * 不同媒体类型支持的 metric 不一样，所以拆开取，拿不到播放量就记 0。
   * Instagram 没有「转发」这个概念，shares 恒为 0。
   */
  async fetchPostMetrics(account: Account, platformPostId: string): Promise<PostMetrics | null> {
    const session = readSession(account)
    if (!session) return null
    const token = session.pageAccessToken

    try {
      const res = await graphGet<{ like_count?: number; comments_count?: number }>(
        `/${platformPostId}`,
        { fields: 'like_count,comments_count' },
        token,
      )
      return {
        views: await this.fetchViews(platformPostId, token),
        likes: res.like_count ?? 0,
        comments: res.comments_count ?? 0,
        shares: 0,
      }
    } catch (err) {
      this.logger.warn(`拉取 Instagram 作品指标失败 ${platformPostId}: ${err}`)
      return null
    }
  }

  private async fetchViews(mediaId: string, token: string): Promise<number> {
    try {
      const res = await graphGet<{ data?: Array<{ values?: Array<{ value?: number }> }> }>(
        `/${mediaId}/insights`,
        { metric: 'views' },
        token,
      )
      return res.data?.[0]?.values?.[0]?.value ?? 0
    } catch {
      return 0
    }
  }

  /** 第一步：建容器。Instagram 是两步发布，建容器不等于发出去 */
  private async createContainer(igUserId: string, token: string, content: Content): Promise<string> {
    const res = await graphPost<{ id: string }>(
      `/${igUserId}/media`,
      buildContainerParams(content),
      token,
    )
    return res.id
  }

  /**
   * 第二步之前必须等容器转好。图片会立刻返回 FINISHED，所以这里先查再睡，
   * 不像视频那样一上来就白等一轮。
   */
  private async waitForContainer(containerId: string, token: string): Promise<ContainerOutcome> {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      try {
        const res = await graphGet<{ status_code?: string; status?: string }>(
          `/${containerId}`,
          { fields: 'status_code,status' },
          token,
        )
        if (res.status_code === 'FINISHED') return { ok: true }
        if (res.status_code === 'ERROR' || res.status_code === 'EXPIRED') {
          return { ok: false, error: `素材处理失败：${res.status ?? res.status_code}` }
        }
      } catch (err) {
        // 凭证问题重试多少次都不会变好，但限流这类抖动值得再等一轮
        if (err instanceof GraphError && (err.isAuthError || err.isPermissionError)) throw err
        this.logger.warn(`container status poll failed for ${containerId}: ${err}`)
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
    return { ok: false, error: '素材处理未在预期时间内完成' }
  }

  /** 帖子链接要用短码拼，本地凑不出来，只能回头问一次；快拍没有链接 */
  private async permalink(mediaId: string, token: string): Promise<string | undefined> {
    try {
      const res = await graphGet<{ permalink?: string }>(
        `/${mediaId}`,
        { fields: 'permalink' },
        token,
      )
      return res.permalink
    } catch (err) {
      this.logger.warn(`permalink lookup failed for ${mediaId}: ${err}`)
      return undefined
    }
  }
}

/**
 * 容器参数决定了这条内容以什么形态出现。快拍看文件后缀决定图还是视频，
 * 信息流视频一律按 Reels 投递——Instagram 已经不再单独提供普通视频贴文。
 */
export function buildContainerParams(content: Content): Record<string, string> {
  const fileUrl = content.fileUrl as string
  const isStory = content.type === 'story'
  const isVideo = isStory ? isVideoFile(fileUrl) : content.type !== 'image'

  const params: Record<string, string> = isVideo ? { video_url: fileUrl } : { image_url: fileUrl }
  if (isStory) params.media_type = 'STORIES'
  else if (isVideo) params.media_type = 'REELS'

  // 快拍没有文案位
  if (!isStory) params.caption = buildCaption(content)
  if (isVideo && !isStory && content.thumbnailUrl) params.cover_url = content.thumbnailUrl

  return params
}

export function readSession(account: Account): InstagramSession | null {
  const igUserId = account.sessionData?.igUserId
  const pageAccessToken = account.sessionData?.pageAccessToken
  if (typeof igUserId !== 'string' || typeof pageAccessToken !== 'string') return null
  return { igUserId, pageAccessToken }
}

function buildCaption(content: Content): string {
  const tags = content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
  return [content.caption, tags].filter(Boolean).join('\n\n')
}

function isVideoFile(fileUrl: string): boolean {
  const path = fileUrl.split(/[?#]/)[0].toLowerCase()
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext))
}
