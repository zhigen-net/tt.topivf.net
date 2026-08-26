import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PublishTask } from './publish-task.entity'

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(PublishTask) private repo: Repository<PublishTask>,
    @InjectQueue('publish') private publishQueue: Queue,
  ) {}

  async findAll(page = 1, limit = 20) {
    const [data, total] = await this.repo.findAndCount({ order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit })
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const task = await this.repo.findOneBy({ id })
    if (!task) throw new NotFoundException(`Task ${id} not found`)
    return task
  }

  async create(dto: Partial<PublishTask>) {
    const task = await this.repo.save(this.repo.create(dto))
    const delay = new Date(task.scheduledAt).getTime() - Date.now()
    await this.publishQueue.add('publish-post', { taskId: task.id }, { delay: Math.max(0, delay), attempts: 3, backoff: { type: 'fixed', delay: 5000 } })
    return task
  }

  async remove(id: string) { await this.repo.delete(id) }
}
