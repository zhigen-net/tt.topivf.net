import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PublishTask } from './publish-task.entity'
import { Content } from '../contents/content.entity'
import { Account } from '../accounts/account.entity'
import { BulkCreateTaskDto, CreateTaskDto } from './dto/create-task.dto'
import type { Platform } from '../accounts/account.entity'

/** 发布记录里展示用的账号信息，只挑不敏感的几个字段 */
export interface TaskAccountBrief {
  id: string
  username: string
  displayName: string
  platform: Platform
  avatar?: string
}

export type TaskWithAccounts = PublishTask & { accounts: TaskAccountBrief[] }

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(PublishTask) private repo: Repository<PublishTask>,
    @InjectRepository(Content) private contents: Repository<Content>,
    @InjectRepository(Account) private accounts: Repository<Account>,
    @InjectQueue('publish') private publishQueue: Queue,
  ) {}

  async findAll(workspaceId: string, page = 1, limit = 20, accountId?: string, contentId?: string) {
    const qb = this.repo.createQueryBuilder('t')
      .leftJoinAndSelect('t.content', 'content')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)

    // account_ids 是 text[]，包含判断得用数组包含运算符
    if (accountId) qb.andWhere('t.accountIds @> ARRAY[:accountId]::text[]', { accountId })
    if (contentId) qb.andWhere('t.contentId = :contentId', { contentId })

    const [data, total] = await qb.getManyAndCount()
    return {
      data: await this.attachAccounts(data, workspaceId),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findOne(id: string, workspaceId: string) {
    const task = await this.repo.findOneBy({ id, workspaceId })
    if (!task) throw new NotFoundException(`Task ${id} not found`)
    const [withAccounts] = await this.attachAccounts([task], workspaceId)
    return withAccounts
  }

  /**
   * 任务里只存了 accountIds，前端拿到一串 uuid 没法展示。把整页任务涉及的账号
   * 一次查出来贴回去，账号数多起来时逐条查会打满连接池。
   */
  private async attachAccounts(tasks: PublishTask[], workspaceId: string): Promise<TaskWithAccounts[]> {
    const ids = [...new Set(tasks.flatMap((t) => t.accountIds))]
    const rows = ids.length
      ? await this.accounts.find({
          where: { id: In(ids), workspaceId },
          select: { id: true, username: true, displayName: true, platform: true, avatar: true },
        })
      : []

    const byId = new Map(rows.map((a): [string, TaskAccountBrief] => [a.id, {
      id: a.id,
      username: a.username,
      displayName: a.displayName,
      platform: a.platform,
      avatar: a.avatar,
    }]))

    // 账号删了任务还留着，查不到的这里不补，由前端按 accountIds 显示成已删除
    return tasks.map((t) => Object.assign(t, {
      accounts: t.accountIds.map((id) => byId.get(id)).filter((a): a is TaskAccountBrief => !!a),
    }))
  }

  async create(dto: CreateTaskDto, workspaceId: string) {
    const content = await this.contents.findOneBy({ id: dto.contentId, workspaceId })
    if (!content) throw new NotFoundException(`Content ${dto.contentId} not found`)
    if (content.reviewStatus !== 'approved') {
      throw new BadRequestException('作品未通过审核，不能发布')
    }
    await this.assertAccountsInWorkspace(dto.accountIds, workspaceId)

    return this.enqueue({
      workspaceId,
      contentId: dto.contentId,
      accountIds: dto.accountIds,
      platforms: dto.platforms ?? [],
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : new Date(),
    })
  }

  /** 账号列表来自请求体，不逐个验空间就能把作品发到别人的账号上 */
  private async assertAccountsInWorkspace(ids: string[], workspaceId: string) {
    const found = await this.accounts.countBy({ id: In(ids), workspaceId })
    if (found !== new Set(ids).size) {
      throw new NotFoundException('部分账号不存在或不属于当前工作空间')
    }
  }

  /**
   * 批量发布时选中的作品各自声明了不同的目标平台，账号却是一次性勾的。
   * 把每个作品的账号裁剪成平台对得上的那些，避免建出必然失败的任务。
   */
  async bulkCreate(dto: BulkCreateTaskDto, workspaceId: string) {
    // 按空间过滤而不是报错：批量场景下混进一个越权 id 就整批失败对用户不友好，
    // 但被过滤掉的 id 也绝不会出现在结果里
    const [contents, accounts] = await Promise.all([
      this.contents.findBy({ id: In(dto.contentIds), workspaceId }),
      this.accounts.findBy({ id: In(dto.accountIds), workspaceId }),
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
        workspaceId,
        contentId: content.id,
        accountIds: matched.map((a) => a.id),
        platforms: [...new Set(matched.map((a) => a.platform))],
        scheduledAt,
      }))
    }

    return { created: created.length, skipped, tasks: created }
  }

  async remove(id: string, workspaceId: string) {
    const task = await this.findOne(id, workspaceId)
    await this.repo.delete(task.id)
  }

  private async enqueue(input: Partial<PublishTask>) {
    const task = await this.repo.save(this.repo.create(input))
    const delay = new Date(task.scheduledAt).getTime() - Date.now()
    await this.publishQueue.add('publish-post', { taskId: task.id }, { delay: Math.max(0, delay), attempts: 3, backoff: { type: 'fixed', delay: 5000 } })
    return task
  }
}
