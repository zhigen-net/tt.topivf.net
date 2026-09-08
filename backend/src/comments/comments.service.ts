import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Not, Repository } from 'typeorm'
import { Comment } from './comment.entity'
import { Account, type Platform } from '../accounts/account.entity'
import { PlatformsService } from '../platforms/platforms.service'
import type { PlatformComment } from '../platforms/platform.adapter'
import type { QueryCommentsDto } from './dto/query-comments.dto'
import type { WorkspaceContext } from '../workspaces/workspace-context'

/** 每次同步回看多少条贴文。评论基本挂在近期内容上，翻太深只是白烧配额 */
export const POSTS_PER_SYNC = 25

export interface CommentAccountBrief {
  id: string
  username: string
  displayName: string
  platform: Platform
  avatar?: string
}

export type CommentWithRefs = Comment & {
  account?: CommentAccountBrief
  /** 我们已经回过的内容，直接跟在评论后面展示，省得再查一次 */
  reply?: { message: string; postedAt: Date } | null
}

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name)

  constructor(
    @InjectRepository(Comment) private readonly repo: Repository<Comment>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly platforms: PlatformsService,
    private readonly ds: DataSource,
  ) {}

  /** 拉一个账号的评论并入库，返回这一轮新增了多少条。null 表示这个账号读不到 */
  async syncAccount(account: Account): Promise<number | null> {
    const adapter = this.platforms.getAdapter(account.platform)
    if (!adapter) return null

    const remote = await adapter.fetchComments(account, POSTS_PER_SYNC)
    if (!remote) return null
    if (!remote.length) return 0

    const before = await this.repo.countBy({ accountId: account.id })
    await this.upsert(account, remote)
    await this.markRepliedFromChildren(account.id)

    return (await this.repo.countBy({ accountId: account.id })) - before
  }

  /**
   * 已经存在的行不覆盖：评论内容不会变，而 repliedAt / ignoredAt 是我们自己维护的，
   * 每轮同步都盖一遍会把人工标记冲掉。
   */
  private async upsert(account: Account, remote: PlatformComment[]) {
    const rows = remote.map((c) => ({
      workspaceId: account.workspaceId,
      accountId: account.id,
      platform: account.platform,
      platformCommentId: c.id,
      platformPostId: c.postId,
      parentCommentId: c.parentId ?? null,
      authorId: c.authorId ?? null,
      authorName: c.authorName ?? null,
      message: c.message,
      fromPage: c.fromPage,
      postedAt: c.postedAt,
    }))

    await this.repo.createQueryBuilder().insert().values(rows).orIgnore().execute()
  }

  /**
   * 账号自己发的子评论就是「已回复」的证据。这样在平台 App 里手工回的复也能被
   * 认出来，不会让收件箱一直挂着一条其实已经处理完的评论。
   */
  private markRepliedFromChildren(accountId: string) {
    return this.ds.query(
      `UPDATE comments AS parent
          SET replied_at = child.first_reply
         FROM (
           SELECT parent_comment_id, MIN(posted_at) AS first_reply
             FROM comments
            WHERE account_id = $1 AND from_page AND parent_comment_id IS NOT NULL
            GROUP BY parent_comment_id
         ) AS child
        WHERE parent.account_id = $1
          AND parent.platform_comment_id = child.parent_comment_id
          AND parent.replied_at IS NULL`,
      [accountId],
    )
  }

  /**
   * 手动同步一个空间下的账号。单个账号读不到（没授权 / 平台不支持）只跳过，
   * 不能让一个坏账号把整轮同步带崩。
   */
  async syncWorkspace(workspaceId: string) {
    const accounts = await this.accounts.findBy({ workspaceId, status: Not('banned') })
    let synced = 0
    let created = 0

    for (const account of accounts) {
      try {
        const n = await this.syncAccount(account)
        if (n === null) continue
        synced++
        created += n
      } catch (err) {
        this.logger.warn(`同步评论失败 @${account.username}: ${err}`)
      }
    }

    return { accounts: synced, created }
  }

  async findAll(
    workspaceId: string,
    opts: QueryCommentsDto,
    accountScope?: string[],
  ): Promise<Paginated<CommentWithRefs>> {
    const { accountId, platform, status = 'pending', search, page = 1, limit = 20 } = opts

    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.workspaceId = :workspaceId', { workspaceId })
      // 自己发的回复不该出现在收件箱里，它们只作为「已回复」的证据和附在父评论上的内容
      .andWhere('c.fromPage = false')
      .orderBy('c.postedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)

    if (accountId) qb.andWhere('c.accountId = :accountId', { accountId })
    if (platform) qb.andWhere('c.platform = :platform', { platform })
    if (search) qb.andWhere('c.message ILIKE :search', { search: `%${search}%` })

    if (status === 'pending') qb.andWhere('c.repliedAt IS NULL AND c.ignoredAt IS NULL')
    else if (status === 'replied') qb.andWhere('c.repliedAt IS NOT NULL')
    else if (status === 'ignored') qb.andWhere('c.ignoredAt IS NOT NULL')

    // 限定了可见账号就得在 SQL 里筛掉，否则 total 会把看不见的评论也算进去
    if (accountScope) {
      qb.andWhere('c.accountId IN (:...accountScope)', {
        accountScope: accountScope.length ? accountScope : [NO_ACCOUNT],
      })
    }

    const [data, total] = await qb.getManyAndCount()
    return {
      data: await this.attachRefs(data, workspaceId),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /** 侧栏角标用，只要一个数 */
  pendingCount(workspaceId: string) {
    return this.repo
      .createQueryBuilder('c')
      .where('c.workspaceId = :workspaceId', { workspaceId })
      .andWhere('c.fromPage = false')
      .andWhere('c.repliedAt IS NULL AND c.ignoredAt IS NULL')
      .getCount()
  }

  /** 账号列表页每行一个数。整页一次算完，逐行查会打满连接池 */
  async pendingCountByAccount(workspaceId: string): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('c')
      .select('c.accountId', 'accountId')
      .addSelect('COUNT(*)', 'count')
      .where('c.workspaceId = :workspaceId', { workspaceId })
      .andWhere('c.fromPage = false')
      .andWhere('c.repliedAt IS NULL AND c.ignoredAt IS NULL')
      .groupBy('c.accountId')
      .getRawMany<{ accountId: string; count: string }>()

    return Object.fromEntries(rows.map((r) => [r.accountId, Number(r.count)]))
  }

  async reply(id: string, message: string, ws: WorkspaceContext): Promise<CommentWithRefs> {
    const comment = await this.findOne(id, ws)
    const account = await this.accounts.findOneBy({ id: comment.accountId, workspaceId: ws.id })
    if (!account) throw new NotFoundException('评论所属的账号已不存在')

    const adapter = this.platforms.getAdapter(account.platform)
    if (!adapter) throw new BadRequestException(`${account.platform} 暂不支持回复评论`)

    const replyId = await adapter.replyComment(account, comment.platformCommentId, message)
    const now = new Date()

    // 平台侧已经发出去了，本地这一步再失败也不能让调用方以为没发成功
    try {
      await this.repo.createQueryBuilder().insert().values({
        workspaceId: account.workspaceId,
        accountId: account.id,
        platform: account.platform,
        platformCommentId: replyId,
        platformPostId: comment.platformPostId,
        parentCommentId: comment.platformCommentId,
        authorName: account.displayName,
        message,
        fromPage: true,
        postedAt: now,
      }).orIgnore().execute()

      await this.repo.update(comment.id, { repliedAt: now, ignoredAt: null })
    } catch (err) {
      this.logger.error(`回复已发到平台但本地入库失败 ${comment.id}: ${err}`)
    }

    const updated = (await this.repo.findOneBy({ id: comment.id })) ?? comment
    return (await this.attachRefs([updated], ws.id))[0]
  }

  async setIgnored(id: string, ignored: boolean, ws: WorkspaceContext) {
    const comment = await this.findOne(id, ws)
    await this.repo.update(comment.id, { ignoredAt: ignored ? new Date() : null })
    return { ...comment, ignoredAt: ignored ? new Date() : null }
  }

  async findOne(id: string, ws: WorkspaceContext): Promise<Comment> {
    const comment = await this.repo.findOneBy({ id, workspaceId: ws.id })
    if (!comment) throw new NotFoundException('评论不存在')
    return comment
  }

  /**
   * 评论行上只有 uuid 和平台侧 id，前端拿着没法展示。整页涉及的账号查一次贴回去，
   * 回复也一次性捞回来，逐条查会打满连接池。同 PostsService.attachRefs。
   */
  private async attachRefs(comments: Comment[], workspaceId: string): Promise<CommentWithRefs[]> {
    if (!comments.length) return []

    const accountIds = [...new Set(comments.map((c) => c.accountId))]
    const accounts = await this.accounts.find({
      where: { id: In(accountIds), workspaceId },
      select: { id: true, username: true, displayName: true, platform: true, avatar: true },
    })
    const byAccount = new Map(accounts.map((a) => [a.id, a]))

    const replies = await this.repo.find({
      where: {
        accountId: In(accountIds),
        fromPage: true,
        parentCommentId: In(comments.map((c) => c.platformCommentId)),
      },
      order: { postedAt: 'ASC' },
    })
    const byParent = new Map(replies.map((r) => [r.parentCommentId, r]))

    return comments.map((c) => {
      const account = byAccount.get(c.accountId)
      const reply = byParent.get(c.platformCommentId)
      return Object.assign(c, {
        account: account && {
          id: account.id,
          username: account.username,
          displayName: account.displayName,
          platform: account.platform,
          avatar: account.avatar,
        },
        reply: reply ? { message: reply.message, postedAt: reply.postedAt } : null,
      })
    })
  }
}

/** IN () 是语法错误，可见账号为空时拿一个不可能匹配的值占位 */
const NO_ACCOUNT = '00000000-0000-0000-0000-000000000000'
