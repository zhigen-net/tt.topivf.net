import type { Account } from '../accounts/account.entity'
import type { Content } from '../contents/content.entity'

export interface PostResult {
  success: boolean
  postUrl?: string
  postId?: string
  error?: string
}

export interface AccountStats {
  followers: number
  following: number
  postsCount: number
}

export interface PostMetrics {
  views: number
  likes: number
  comments: number
  shares: number
}

/** 平台评论的归一化形态，各家字段名差得远，落库前统一成这个 */
export interface PlatformComment {
  id: string
  postId: string
  /** 平台侧父评论 id，顶层评论没有 */
  parentId?: string
  message: string
  authorId?: string
  authorName?: string
  postedAt: Date
  /** 是账号自己发的（我们的回复，或在平台 App 里手工回的） */
  fromPage: boolean
}

export abstract class PlatformAdapter {
  abstract readonly platform: string

  abstract publish(account: Account, content: Content): Promise<PostResult>
  abstract fetchStats(account: Account): Promise<AccountStats>
  abstract checkHealth(account: Account): Promise<boolean>

  /**
   * 拉某条已发布作品的指标。返回 null 表示这个平台/这条授权拿不到，
   * 调度器会据此跳过而不是把它当成「全是 0」写回去。
   */
  fetchPostMetrics(_account: Account, _platformPostId: string): Promise<PostMetrics | null> {
    return Promise.resolve(null)
  }

  /**
   * 拉这个账号近期贴文下的评论。扫的是平台上的贴文而不是 posts 表——大部分评论
   * 挂在 SocialHub 接管之前就发过的内容上，只看自己发的会一条都扫不到。
   * 返回 null 表示这个平台/这条授权拿不到，调度器据此跳过而不是当成「没有评论」。
   */
  fetchComments(_account: Account, _postLimit: number): Promise<PlatformComment[] | null> {
    return Promise.resolve(null)
  }

  /** 回复一条评论，返回平台侧新评论的 id */
  replyComment(_account: Account, _platformCommentId: string, _message: string): Promise<string> {
    return Promise.reject(new Error('该平台暂不支持回复评论'))
  }
}
