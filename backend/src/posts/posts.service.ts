import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { Post } from './post.entity'
import type { PostMetrics } from '../platforms/platform.adapter'
import type { Platform } from '../accounts/account.entity'

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
