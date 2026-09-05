import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, In, Repository } from 'typeorm'
import { Post } from './post.entity'
import { Account } from '../accounts/account.entity'
import { Content } from '../contents/content.entity'
import type { QueryPostsDto } from './dto/query-posts.dto'
import type { PostMetrics } from '../platforms/platform.adapter'
import type { Platform } from '../accounts/account.entity'

/** 展示用的账号信息，只挑不敏感的几个字段 */
export interface PostAccountBrief {
  id: string
  username: string
  displayName: string
  platform: Platform
  avatar?: string
}

export type PostWithRefs = Post & {
  account?: PostAccountBrief
  contentTitle?: string
}

export interface PostsSummary {
  posts: number
  views: number
  likes: number
  comments: number
  shares: number
  /** 已经成功拉到过指标的条数，用来说明合计数覆盖了多少 */
  measured: number
}

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface RecordPostInput {
  workspaceId?: string
  contentId: string
  accountId: string
  platform: Platform
  platformPostId: string
  postUrl?: string
  publishedAt: Date
}

@Injectable()
export class PostsService implements OnModuleInit {
  private readonly logger = new Logger(PostsService.name)

  constructor(
    @InjectRepository(Post) private readonly repo: Repository<Post>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    @InjectRepository(Content) private readonly contents: Repository<Content>,
    private readonly ds: DataSource,
  ) {}

  onModuleInit() {
    return this.backfill()
  }

  /**
   * 同一条作品重发到同一个账号会拿到新的平台 id，是新的一行；重复投递同一个 id
   * 则忽略，不覆盖已经拉到的数据。
   */
  async record(input: RecordPostInput) {
    await this.repo
      .createQueryBuilder()
      .insert()
      .values(input)
      .orIgnore()
      .execute()
  }

  listByContent(contentId: string, workspaceId: string) {
    return this.repo.find({
      where: { contentId, workspaceId },
      order: { publishedAt: 'DESC' },
    })
  }

  listByAccount(accountId: string, workspaceId: string, take = 50) {
    return this.repo.find({
      where: { accountId, workspaceId },
      order: { publishedAt: 'DESC' },
      take,
    })
  }

  async findAll(workspaceId: string, opts: QueryPostsDto): Promise<Paginated<PostWithRefs>> {
    const { contentId, accountId, platform, sort = 'publishedAt', page = 1, limit = 20 } = opts

    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.workspaceId = :workspaceId', { workspaceId })
      .orderBy(`p.${sort}`, 'DESC')
      .skip((page - 1) * limit)
      .take(limit)

    if (contentId) qb.andWhere('p.contentId = :contentId', { contentId })
    if (accountId) qb.andWhere('p.accountId = :accountId', { accountId })
    if (platform) qb.andWhere('p.platform = :platform', { platform })

    // 按指标排序时把没拉到过数据的排到最后，否则一堆 0 会顶在排行榜前面
    if (sort !== 'publishedAt') qb.addOrderBy('p.publishedAt', 'DESC')

    const [data, total] = await qb.getManyAndCount()
    return {
      data: await this.attachRefs(data, workspaceId),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /** 概览卡片用的合计，和列表分页无关，所以单独一次聚合 */
  async summary(workspaceId: string): Promise<PostsSummary> {
    const row = await this.repo
      .createQueryBuilder('p')
      .select('COUNT(*)::int', 'posts')
      .addSelect('COALESCE(SUM(p.views), 0)::int', 'views')
      .addSelect('COALESCE(SUM(p.likes), 0)::int', 'likes')
      .addSelect('COALESCE(SUM(p.comments), 0)::int', 'comments')
      .addSelect('COALESCE(SUM(p.shares), 0)::int', 'shares')
      .addSelect('COUNT(p.metrics_updated_at)::int', 'measured')
      .where('p.workspaceId = :workspaceId', { workspaceId })
      .getRawOne<PostsSummary>()

    return row ?? { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, measured: 0 }
  }

  /**
   * posts 上只有 uuid，前端拿一串 id 没法展示。整页涉及的账号和作品各查一次贴回去，
   * 逐条查会打满连接池。同 TasksService.attachAccounts。
   */
  private async attachRefs(posts: Post[], workspaceId: string): Promise<PostWithRefs[]> {
    const accountIds = [...new Set(posts.map((p) => p.accountId))]
    const contentIds = [...new Set(posts.map((p) => p.contentId))]

    const accounts: Account[] = accountIds.length
      ? await this.accounts.find({
          where: { id: In(accountIds), workspaceId },
          select: { id: true, username: true, displayName: true, platform: true, avatar: true },
        })
      : []
    const contents: Content[] = contentIds.length
      ? await this.contents.find({
          where: { id: In(contentIds), workspaceId },
          select: { id: true, title: true },
        })
      : []

    const byAccount = new Map(accounts.map((a) => [a.id, a]))
    const byContent = new Map(contents.map((c) => [c.id, c]))

    return posts.map((p) => {
      const account = byAccount.get(p.accountId)
      const content = byContent.get(p.contentId)
      return Object.assign(p, {
        account: account && {
          id: account.id,
          username: account.username,
          displayName: account.displayName,
          platform: account.platform,
          avatar: account.avatar,
        },
        contentTitle: content?.title,
      })
    })
  }

  /**
   * 挑该刷指标的作品：没拉过的排在最前，其余按最久没刷的先来。
   * 太老的作品数据基本不动了，一直刷它们只是白白消耗平台配额。
   */
  findStale(staleBefore: Date, publishedAfter: Date, take: number) {
    return this.repo
      .createQueryBuilder('p')
      .where('p.published_at > :publishedAfter', { publishedAfter })
      .andWhere('(p.metrics_updated_at IS NULL OR p.metrics_updated_at < :staleBefore)', {
        staleBefore,
      })
      .orderBy('p.metrics_updated_at', 'ASC', 'NULLS FIRST')
      .limit(take)
      .getMany()
  }

  async saveMetrics(id: string, metrics: PostMetrics) {
    await this.repo.update(id, { ...metrics, metricsUpdatedAt: new Date() })
  }

  /**
   * 拉不到也要记一笔时间。否则这条会永远排在「没拉过」的最前面，每轮都占着
   * 名额重试同一批拿不到的作品，把后面的饿死。
   */
  async markAttempted(id: string) {
    await this.repo.update(id, { metricsUpdatedAt: new Date() })
  }

  /**
   * posts 表是后加的，但平台侧 id 一直都被写进了 publish_tasks.results，
   * 所以历史发布记录能整个捞回来，不需要重发。冲突忽略，重复启动无副作用。
   */
  private async backfill() {
    try {
      const inserted = await this.ds.query<{ id: string }[]>(
      `INSERT INTO posts (
         workspace_id, content_id, account_id, platform,
         platform_post_id, post_url, published_at
       )
       SELECT
         t.workspace_id,
         t.content_id::uuid,
         (r->>'accountId')::uuid,
         (r->>'platform')::posts_platform_enum,
         r->>'postId',
         r->>'postUrl',
         COALESCE(t.completed_at, t.created_at)
       FROM publish_tasks t, jsonb_array_elements(t.results) r
       WHERE (r->>'success')::boolean IS TRUE
         AND r->>'postId' IS NOT NULL
         AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = (r->>'accountId')::uuid)
       ON CONFLICT (account_id, platform_post_id) DO NOTHING
       RETURNING id`,
      )
      if (inserted.length) this.logger.log(`已从历史发布任务回填 ${inserted.length} 条发布记录`)
    } catch (err) {
      // 回填只是补历史，失败了不该让整个服务起不来
      this.logger.error(`回填历史发布记录失败: ${err}`)
    }
  }
}
