import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PublishTask } from './publish-task.entity'
import { Content } from '../contents/content.entity'
import { Account } from '../accounts/account.entity'
import { BulkCreateTaskDto, CreateTaskDto } from './dto/create-task.dto'

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(PublishTask) private repo: Repository<PublishTask>,
    @InjectRepository(Content) private contents: Repository<Content>,
    @InjectRepository(Account) private accounts: Repository<Account>,
    @InjectQueue('publish') private publishQueue: Queue,
  ) {}

  async findAll(page = 1, limit = 20, accountId?: string, contentId?: string) {
    const qb = this.repo.createQueryBuilder('t')
      .leftJoinAndSelect('t.content', 'content')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)

    // account_ids 是 text[]，包含判断得用数组包含运算符
    if (accountId) qb.andWhere('t.accountIds @> ARRAY[:accountId]::text[]', { accountId })
    if (contentId) qb.andWhere('t.contentId = :contentId', { contentId })

    const [data, total] = await qb.getManyAndCount()
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(id: string) {
    const task = await this.repo.findOneBy({ id })
    if (!task) throw new NotFoundException(`Task ${id} not found`)
    return task
  }

  async create(dto: CreateTaskDto) {
    const content = await this.contents.findOneBy({ id: dto.contentId })
    if (!content) throw new NotFoundException(`Content ${dto.contentId} not found`)
    if (content.reviewStatus !== 'approved') {
      throw new BadRequestException('作品未通过审核，不能发布')
    }

    return this.enqueue({
      contentId: dto.contentId,
      accountIds: dto.accountIds,
      platforms: dto.platforms ?? [],
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : new Date(),
    })
  }

  /**
   * 批量发布时选中的作品各自声明了不同的目标平台，账号却是一次性勾的。
   * 把每个作品的账号裁剪成平台对得上的那些，避免建出必然失败的任务。
   */
  async bulkCreate(dto: BulkCreateTaskDto) {
    const [contents, accounts] = await Promise.all([
      this.contents.findBy({ id: In(dto.contentIds) }),
      this.accounts.findBy({ id: In(dto.accountIds) }),
    ])

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date()
    const created: PublishTask[] = []
    const skipped: { contentId: string; title: string; reason: string }[] = []

    for (const content of contents) {
      if (content.reviewStatus !== 'approved') {
        skipped.push({ contentId: content.id, title: content.title, reason: '未通过审核' })
        continue
      }
      const matched = accounts.filter((a) => content.platforms.includes(a.platform))
      if (matched.length === 0) {
        skipped.push({ contentId: content.id, title: content.title, reason: '没有平台匹配的账号' })
        continue
      }
      created.push(await this.enqueue({
        contentId: content.id,
        accountIds: matched.map((a) => a.id),
        platforms: [...new Set(matched.map((a) => a.platform))],
        scheduledAt,
      }))
    }

    return { created: created.length, skipped, tasks: created }
  }

  async remove(id: string) { await this.repo.delete(id) }

  private async enqueue(input: Partial<PublishTask>) {
    const task = await this.repo.save(this.repo.create(input))
    const delay = new Date(task.scheduledAt).getTime() - Date.now()
    await this.publishQueue.add('publish-post', { taskId: task.id }, { delay: Math.max(0, delay), attempts: 3, backoff: { type: 'fixed', delay: 5000 } })
    return task
  }
}
