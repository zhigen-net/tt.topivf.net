import { Processor, Process } from '@nestjs/bull'
import { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PublishTask } from './publish-task.entity'

@Processor('publish')
export class TasksProcessor {
  private readonly logger = new Logger(TasksProcessor.name)

  constructor(@InjectRepository(PublishTask) private repo: Repository<PublishTask>) {}

  @Process('publish-post')
  async handlePublish(job: Job<{ taskId: string }>) {
    const { taskId } = job.data
    this.logger.log(`Processing publish task ${taskId}`)

    await this.repo.update(taskId, { status: 'running' })

    try {
      // Platform adapters will be called here per account
      // For now, mark as done (stub)
      await this.repo.update(taskId, { status: 'done', completedAt: new Date() })
      this.logger.log(`Task ${taskId} completed`)
    } catch (err) {
      await this.repo.update(taskId, { status: 'failed' })
      this.logger.error(`Task ${taskId} failed`, err)
      throw err
    }
  }
}
