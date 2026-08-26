import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PublishTask, TaskResult } from './publish-task.entity'
import { AccountsService } from '../accounts/accounts.service'
import { PlatformsService } from '../platforms/platforms.service'
import type { Platform } from '../accounts/account.entity'

@Processor('publish')
export class TasksProcessor extends WorkerHost {
  private readonly logger = new Logger(TasksProcessor.name)

  constructor(
    @InjectRepository(PublishTask) private repo: Repository<PublishTask>,
    private accountsService: AccountsService,
    private platformsService: PlatformsService,
  ) {
    super()
  }

  async process(job: Job<{ taskId: string }>) {
    const { taskId } = job.data
    this.logger.log(`Processing task ${taskId}`)

    const task = await this.repo.findOne({ where: { id: taskId }, relations: { content: true } })
    if (!task) {
      this.logger.error(`Task ${taskId} not found`)
      return
    }

    await this.repo.update(taskId, { status: 'running' })

    const results: TaskResult[] = []

    for (const accountId of task.accountIds) {
      try {
        const account = await this.accountsService.findOne(accountId)
        const adapter = this.platformsService.getAdapter(account.platform)

        if (!adapter) {
          results.push({ accountId, platform: account.platform, success: false, error: `No adapter for ${account.platform}` })
          continue
        }

        const result = await adapter.publish(account, task.content)
        results.push({ accountId, platform: account.platform as Platform, ...result })
        this.logger.log(`Account ${account.username} (${account.platform}): ${result.success ? 'ok' : result.error}`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ accountId, platform: 'tiktok', success: false, error: msg })
        this.logger.error(`Account ${accountId} failed: ${msg}`)
      }
    }

    const anySuccess = results.some((r) => r.success)
    const allFailed = results.length > 0 && results.every((r) => !r.success)

    await this.repo.update(taskId, {
      status: allFailed ? 'failed' : 'done',
      results,
      completedAt: new Date(),
    })

    this.logger.log(`Task ${taskId} finished — ${results.filter((r) => r.success).length}/${results.length} succeeded`)
  }
}
