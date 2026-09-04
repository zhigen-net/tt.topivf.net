import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MetaCredential } from './meta-credential.entity'
import { CredentialsService } from './credentials.service'
import { SecretBox } from '../crypto/secret-box'

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000
// 刚起来就打一轮 Graph 会拖慢启动，也容易和迁移撞上
const FIRST_SWEEP_DELAY_MS = 2 * 60 * 1000
// 逐条串行并留间隔，避免几十条凭证同时打 Graph 触发限流
const BETWEEN_CREDENTIALS_MS = 1_000

/**
 * 定时确认托管的令牌还活着，并把新出现的主页记成待接入。
 * 只用 setInterval：需求就是「每几小时扫一遍」，不值得为它引入调度依赖。
 */
@Injectable()
export class CredentialsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CredentialsScheduler.name)
  private timer?: NodeJS.Timeout
  private kickoff?: NodeJS.Timeout
  private running = false

  constructor(
    @InjectRepository(MetaCredential) private readonly repo: Repository<MetaCredential>,
    private readonly svc: CredentialsService,
    private readonly secrets: SecretBox,
  ) {}

  onModuleInit() {
    if (!this.secrets.enabled) {
      this.logger.warn('未配置加密密钥，凭证巡检不启动')
      return
    }
    this.kickoff = setTimeout(() => {
      void this.sweep()
      this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS)
      this.timer.unref()
    }, FIRST_SWEEP_DELAY_MS)
    this.kickoff.unref()
  }

  onModuleDestroy() {
    clearTimeout(this.kickoff)
    clearInterval(this.timer)
  }

  async sweep() {
    // 上一轮还没跑完就跳过，凭证多时一轮可能超过间隔
    if (this.running) return
    this.running = true

    try {
      const credentials = await this.repo.find()
      if (!credentials.length) return

      let invalid = 0
      let pending = 0
      for (const credential of credentials) {
        const after = await this.svc.check(credential)
        if (after.status === 'invalid') invalid++
        pending += after.pendingTargets.length
        await sleep(BETWEEN_CREDENTIALS_MS)
      }

      this.logger.log(
        `凭证巡检完成：共 ${credentials.length} 条，失效 ${invalid} 条，待接入目标 ${pending} 个`,
      )
    } catch (err) {
      // 巡检是后台任务，任何异常都不该让进程挂掉
      this.logger.error(`凭证巡检异常: ${err}`)
    } finally {
      this.running = false
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
