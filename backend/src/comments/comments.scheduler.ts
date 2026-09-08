import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Not, Repository } from 'typeorm'
import { Account } from '../accounts/account.entity'
import { CommentsService } from './comments.service'

const SWEEP_INTERVAL_MS = 30 * 60 * 1000
// 让开启动、凭证巡检（2 分钟）和指标回收（3 分钟）那几波
const FIRST_SWEEP_DELAY_MS = 4 * 60 * 1000
// 逐个账号串行并留间隔，避免一批几十个同时打平台接口触发限流
const BETWEEN_ACCOUNTS_MS = 1_000

/** 把各平台近期贴文下的评论收进 comments 表，前端的收件箱只读本地库 */
@Injectable()
export class CommentsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommentsScheduler.name)
  private timers: NodeJS.Timeout[] = []
  private running = false

  constructor(
    @InjectRepository(Account) private readonly accountRepo: Repository<Account>,
    private readonly comments: CommentsService,
  ) {}

  onModuleInit() {
    const kickoff = setTimeout(() => {
      void this.sweep()
      const timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS)
      timer.unref()
      this.timers.push(timer)
    }, FIRST_SWEEP_DELAY_MS)
    kickoff.unref()
    this.timers.push(kickoff)
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t)
  }

  async sweep() {
    // 上一轮还没跑完就跳过，账号多时一轮可能超过间隔
    if (this.running) return
    this.running = true

    try {
      // 封禁的账号读不动，白打一轮接口
      const accounts = await this.accountRepo.findBy({ status: Not('banned') })
      if (!accounts.length) return

      let created = 0
      let reached = 0
      for (const account of accounts) {
        try {
          const n = await this.comments.syncAccount(account)
          if (n !== null) {
            reached++
            created += n
          }
        } catch (err) {
          this.logger.warn(`同步评论失败 @${account.username}: ${err}`)
        }
        await sleep(BETWEEN_ACCOUNTS_MS)
      }

      this.logger.log(`评论同步完成：扫描 ${accounts.length} 个账号，读到 ${reached} 个，新增 ${created} 条`)
    } catch (err) {
      // 后台任务，任何异常都不该让进程挂掉
      this.logger.error(`评论同步异常: ${err}`)
    } finally {
      this.running = false
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
