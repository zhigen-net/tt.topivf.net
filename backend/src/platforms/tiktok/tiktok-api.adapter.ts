import { Injectable, Logger } from '@nestjs/common'
import { PlatformAdapter, PostResult, AccountStats, PostMetrics } from '../platform.adapter'
import { tiktokGet, tiktokPost, TiktokApiError } from './tiktok-api'
import { VIDEO_LIST_SCOPE } from './tiktok-oauth'
import { TiktokTokenService, readSession } from './tiktok-token.service'
import { uploadChunks, planChunks } from './tiktok-upload'
import type { Account } from '../../accounts/account.entity'
import type { Content } from '../../contents/content.entity'

const POLL_INTERVAL_MS = 5_000
const POLL_MAX_ATTEMPTS = 60
/** TikTok 文案上限 2200 字符，超了整个请求会被拒 */
const CAPTION_MAX = 2200

interface CreatorInfo {
  creator_username?: string
  creator_nickname?: string
  privacy_level_options?: string[]
  max_video_post_duration_sec?: number
  comment_disabled?: boolean
  duet_disabled?: boolean
  stitch_disabled?: boolean
}

interface PublishStatus {
  status?: string
  fail_reason?: string
  publicaly_available_post_id?: string[]
  publicly_available_post_id?: string[]
}

/**
 * 走官方 Content Posting API。视频由后端读出来再分片 PUT 给 TikTok，
 * 所以不需要在开发者后台验证域名所有权，MinIO 的内网地址也能用。
 */
@Injectable()
export class TiktokApiAdapter extends PlatformAdapter {
  readonly platform = 'tiktok'
  private readonly logger = new Logger(TiktokApiAdapter.name)

  constructor(private readonly tokens: TiktokTokenService) {
    super()
  }

  async publish(account: Account, content: Content): Promise<PostResult> {
    if (!content.fileUrl) return { success: false, error: '作品没有文件地址' }

    try {
      const { token, scopes } = await this.tokens.freshAccessToken(account)
      const creator = await this.creatorInfo(token)

      const file = await fetchBuffer(content.fileUrl)
      const duration = content.duration ?? 0
      const maxDuration = creator.max_video_post_duration_sec ?? 0
      if (maxDuration > 0 && duration > maxDuration) {
        return { success: false, error: `视频 ${duration}s 超过该账号允许的 ${maxDuration}s` }
      }

      // 没拿到 video.publish 就只能进草稿箱，让用户去 App 里手动发
      const direct = scopes.includes('video.publish')
      const publishId = direct
        ? await this.initDirectPost(token, content, file.length, creator)
        : await this.initInbox(token, file.length)

      await uploadChunks(
        publishId.uploadUrl, file, mimeTypeOf(content.fileUrl),
        (done, total) => this.logger.debug(`@${account.username} 分片 ${done}/${total}`),
      )

      const outcome = await this.waitForPublish(publishId.id, token)
      if (!outcome.ok) return { success: false, error: outcome.error }

      if (!direct) this.logger.warn(`@${account.username} 缺 video.publish，视频只进了草稿箱`)
      return { success: true, postId: outcome.postId ?? publishId.id, postUrl: outcome.postUrl }
    } catch (err) {
      const msg = err instanceof TiktokApiError ? `[${err.code}] ${err.message}` : String(err)
      this.logger.error(`TikTok 发布失败 @${account.username}: ${msg}`)
      return { success: false, error: msg }
    }
  }

  async fetchStats(account: Account): Promise<AccountStats> {
    const fallback = {
      followers: account.followers,
      following: account.following,
      postsCount: account.postsCount,
    }
    try {
      const { token } = await this.tokens.freshAccessToken(account)
      const res = await tiktokGet<{ user: Record<string, number> }>(
        '/user/info/', { fields: 'follower_count,following_count,video_count' }, token,
      )
      const u = res.user
      if (typeof u?.follower_count !== 'number') return fallback
      return {
        followers: u.follower_count,
        following: u.following_count ?? fallback.following,
        postsCount: u.video_count ?? fallback.postsCount,
      }
    } catch (err) {
      this.logger.warn(`拉取 TikTok 统计失败 @${account.username}: ${err}`)
      return fallback
    }
  }

  async checkHealth(account: Account): Promise<boolean> {
    if (!readSession(account)) return false
    try {
      const { token } = await this.tokens.freshAccessToken(account)
      await tiktokGet('/user/info/', { fields: 'open_id' }, token)
      return true
    } catch (err) {
      this.logger.warn(`TikTok 健康检查失败 @${account.username}: ${err}`)
      return false
    }
  }

  /**
   * video.list 是本次才加进 TIKTOK_SCOPES 的，早先授权的账号令牌上没有。
   * 硬发过去只会拿到 scope_not_authorized，所以先看实际 scopes 再决定。
   */
  async fetchPostMetrics(account: Account, platformPostId: string): Promise<PostMetrics | null> {
    if (!readSession(account)) return null

    try {
      const { token, scopes } = await this.tokens.freshAccessToken(account)
      if (!scopes.includes(VIDEO_LIST_SCOPE)) {
        this.logger.warn(`@${account.username} 的授权不含 ${VIDEO_LIST_SCOPE}，跳过指标回收`)
        return null
      }

      const res = await tiktokPost<{ videos?: Array<Record<string, number>> }>(
        '/video/query/?fields=id,view_count,like_count,comment_count,share_count',
        { filters: { video_ids: [platformPostId] } },
        token,
      )

      // 作品被删掉时 videos 是空数组而不是报错
      const video = res.videos?.[0]
      if (!video) return null

      return {
        views: video.view_count ?? 0,
        likes: video.like_count ?? 0,
        comments: video.comment_count ?? 0,
        shares: video.share_count ?? 0,
      }
    } catch (err) {
      this.logger.warn(`拉取 TikTok 作品指标失败 ${platformPostId}: ${err}`)
      return null
    }
  }

  /** 直接发布前必须先查一次，拿到这个账号当前允许的可见性和时长上限 */
  private creatorInfo(token: string): Promise<CreatorInfo> {
    return tiktokPost<CreatorInfo>('/post/publish/creator_info/query/', {}, token)
  }

  private initDirectPost(token: string, content: Content, size: number, creator: CreatorInfo) {
    return this.init(token, '/post/publish/video/init/', size, {
      post_info: {
        title: buildCaption(content),
        privacy_level: pickPrivacy(creator.privacy_level_options),
        disable_comment: creator.comment_disabled ?? false,
        disable_duet: creator.duet_disabled ?? false,
        disable_stitch: creator.stitch_disabled ?? false,
      },
    })
  }

  private initInbox(token: string, size: number) {
    return this.init(token, '/post/publish/inbox/video/init/', size, {})
  }

  private async init(token: string, path: string, size: number, extra: object) {
    const plan = planChunks(size)
    const res = await tiktokPost<{ publish_id: string; upload_url: string }>(path, {
      ...extra,
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: size,
        chunk_size: plan.chunkSize,
        total_chunk_count: plan.totalChunks,
      },
    }, token)
    return { id: res.publish_id, uploadUrl: res.upload_url }
  }

  /**
   * 上传完成不等于发布完成，TikTok 还要转码和审核。这里轮询到终态为止，
   * 否则任务会在「上传成功但视频没出现」的状态下被误标为成功。
   */
  private async waitForPublish(publishId: string, token: string): Promise<
    { ok: true; postId?: string; postUrl?: string } | { ok: false; error: string }
  > {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS)
      const res = await tiktokPost<PublishStatus>(
        '/post/publish/status/fetch/', { publish_id: publishId }, token,
      )

      switch (res.status) {
        case 'PUBLISH_COMPLETE':
        case 'SEND_TO_USER_INBOX': {
          // 字段名 TikTok 自己拼错过一版，两个都得认
          const ids = res.publicly_available_post_id ?? res.publicaly_available_post_id ?? []
          return { ok: true, postId: ids[0], postUrl: ids[0] ? postUrlOf(ids[0]) : undefined }
        }
        case 'FAILED':
          return { ok: false, error: res.fail_reason || 'TikTok 未说明失败原因' }
      }
    }
    return { ok: false, error: `等待 ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s 后仍未完成发布` }
  }
}

/**
 * 应用过审前 TikTok 只会给 SELF_ONLY。硬编码 PUBLIC_TO_EVERYONE 会被直接拒，
 * 所以按平台返回的可选项挑最公开的那个——过审后自动就能公开发布，不用改代码。
 */
export function pickPrivacy(options?: string[]): string {
  const preference = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY']
  return preference.find((p) => options?.includes(p)) ?? 'SELF_ONLY'
}

export function buildCaption(content: Content): string {
  const tags = content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
  return [content.caption, tags].filter(Boolean).join(' ').slice(0, CAPTION_MAX)
}

function postUrlOf(postId: string): string {
  return `https://www.tiktok.com/video/${postId}`
}

function mimeTypeOf(url: string): string {
  const name = url.split('?')[0].toLowerCase()
  if (name.endsWith('.mov')) return 'video/quicktime'
  if (name.endsWith('.webm')) return 'video/webm'
  return 'video/mp4'
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5 * 60_000) })
  if (!res.ok) throw new TiktokApiError(`fetch_${res.status}`, `读取作品文件失败：HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
