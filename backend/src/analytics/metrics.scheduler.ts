import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Not, Repository } from 'typeorm'
import { Account } from '../accounts/account.entity'
import { AccountsService } from '../accounts/accounts.service'
import { PostsService } from '../posts/posts.service'
import { AnalyticsService } from './analytics.service'
import { PlatformsService } from '../platforms/platforms.service'

const POST_SWEEP_INTERVAL_MS = 3 * 60 * 60 * 1000
const ACCOUNT_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000
// 让开启动和凭证巡检（2 分钟）那一波
const FIRST_SWEEP_DELAY_MS = 3 * 60 * 1000

/** 指标没这么快变，比这更勤只是白烧平台配额 */
const POST_STALE_MS = 6 * 60 * 60 * 1000
/** 太老的作品数据基本不动了，不值得一直回访 */
const POST_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const POST_BATCH = 50

/** 一天一张快照。留 4 小时余量，免得被调度抖动卡在 24 小时边界上反复跳过 */
const SNAPSHOT_MIN_GAP_MS = 20 * 60 * 60 * 1000

// 逐条串行并留间隔，避免一批几十条同时打平台接口触发限流
const BETWEEN_CALLS_MS = 1_000

/**
 * 把发出去的东西的数据收回来：作品指标写进 posts，账号粉丝数留成每日快照。
 * 和凭证巡检一样只用 setInterval，需求就是「每几小时扫一遍」。
 */
@Injectable()
export class MetricsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsScheduler.name)
  private timers: NodeJS.Timeout[] = []
  private postsRunning = false
  private accountsRunning = false

  constructor(
    @InjectRepository(Account) private readonly accountRepo: Repository<Account>,
    private readonly accounts: AccountsService,
    private readonly posts: PostsService,
    private readonly analytics: AnalyticsService,
    private readonly platforms: PlatformsService,
  ) {}

  onModuleInit() {
    this.schedule(() => this.sweepPosts(), POST_SWEEP_INTERVAL_MS)
    this.schedule(() => this.sweepAccounts(), ACCOUNT_SWEEP_INTERVAL_MS)
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t)
  }

  private schedule(run: () => Promise<void>, intervalMs: number) {
    const kickoff = setTimeout(() => {
      void run()
      const timer = setInterval(() => void run(), intervalMs)
      timer.unref()
      this.timers.push(timer)
    }, FIRST_SWEEP_DELAY_MS)
    kickoff.unref()
    this.timers.push(kickoff)
  }

  async sweepPosts() {
    // 上一轮还没跑完就跳过，作品多时一轮可能超过间隔
    if (this.postsRunning) return
    this.postsRunning = true

    try {
      const now = Date.now()
      const stale = await this.posts.findStale(
        new Date(now - POST_STALE_MS),
        new Date(now - POST_MAX_AGE_MS),
        POST_BATCH,
      )
      if (!stale.length) return

      const ids = [...new Set(stale.map((p) => p.accountId))]
      const accounts = await this.accountRepo.findBy({ id: In(ids) })
      const byId = new Map(accounts.map((a) => [a.id, a]))

      let updated = 0
      for (const post of stale) {
        const account = byId.get(post.accountId)
        const adapter = account && this.platforms.getAdapter(account.platform)

        const metrics = account && adapter
          ? await adapter.fetchPostMetrics(account, post.platformPostId)
          : null

        if (metrics) {
          await this.posts.saveMetrics(post.id, metrics)
          updated++
        } else {
          await this.posts.markAttempted(post.id)
        }
        await sleep(BETWEEN_CALLS_MS)
      }

      this.logger.log(`作品指标回收完成：处理 ${stale.length} 条，成功 ${updated} 条`)
    } catch (err) {
      // 后台任务，任何异常都不该让进程挂掉
      this.logger.error(`作品指标回收异常: ${err}`)
    } finally {
      this.postsRunning = false
    }
  }

  async sweepAccounts() {
    if (this.accountsRunning) return
    this.accountsRunning = true

    try {
      // 封禁的账号查不动，白打一轮接口
      const accounts = await this.accountRepo.findBy({ status: Not('banned') })
      if (!accounts.length) return

      let snapshots = 0
      for (const account of accounts) {
        const adapter = this.platforms.getAdapter(account.platform)
        if (!adapter) continue

        // fetchStats 拿不到时返回的是账号现有值，所以这里不会把粉丝数抹成 0
        const stats = await adapter.fetchStats(account)
        await this.accounts.updateStats(account.id, stats)

        if (await this.analytics.snapshotIfDue(Object.assign(account, stats), SNAPSHOT_MIN_GAP_MS)) {
          snapshots++
        }
        await sleep(BETWEEN_CALLS_MS)
      }

      this.logger.log(`账号快照完成：扫描 ${accounts.length} 个账号，新增快照 ${snapshots} 张`)
    } catch (err) {
      this.logger.error(`账号快照异常: ${err}`)
    } finally {
      this.accountsRunning = false
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
