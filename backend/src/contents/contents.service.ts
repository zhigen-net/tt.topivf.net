import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Content } from './content.entity'
import { PublishTask } from '../tasks/publish-task.entity'
import { CreateContentDto } from './dto/create-content.dto'
import { UpdateContentDto } from './dto/update-content.dto'
import { QueryContentsDto } from './dto/query-contents.dto'

export interface PublishSummary {
  taskCount: number
  doneCount: number
  failedCount: number
  lastPublishedAt: string | null
}

export type ContentWithPublish = Content & PublishSummary

@Injectable()
export class ContentsService {
  constructor(
    @InjectRepository(Content) private repo: Repository<Content>,
    @InjectRepository(PublishTask) private tasks: Repository<PublishTask>,
  ) {}

  async findAll(query: QueryContentsDto) {
    const { search, type, platform, sort = 'createdAt', order = 'DESC', page = 1, limit = 20 } = query

    const qb = this.repo.createQueryBuilder('c')
    if (search) {
      qb.andWhere('(c.title ILIKE :search OR c.caption ILIKE :search)', { search: `%${search}%` })
    }
    if (type) qb.andWhere('c.type = :type', { type })
    if (platform) qb.andWhere(':platform = ANY(c.platforms)', { platform })

    const [data, total] = await qb
      .orderBy(`c.${sort}`, order)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    const summaries = await this.publishSummaries(data.map((c) => c.id))

    return {
      data: data.map((c) => Object.assign(c, summaries.get(c.id) ?? emptySummary())),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findOne(id: string) {
    const item = await this.repo.findOneBy({ id })
    if (!item) throw new NotFoundException(`Content ${id} not found`)
    return item
  }

  async create(dto: CreateContentDto) {
    return this.repo.save(this.repo.create({ ...toEntity(dto), hashtags: dto.hashtags ?? [] }))
  }

  async update(id: string, dto: UpdateContentDto) {
    await this.findOne(id)
    await this.repo.update(id, toEntity(dto))
    return this.findOne(id)
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.repo.delete(id)
  }

  /** 一次性把整页作品的发布情况聚合出来，避免每张卡片各查一次 */
  private async publishSummaries(ids: string[]): Promise<Map<string, PublishSummary>> {
    const map = new Map<string, PublishSummary>()
    if (ids.length === 0) return map

    const rows = await this.tasks
      .createQueryBuilder('t')
      .select('t.contentId', 'contentId')
      .addSelect('COUNT(*)::int', 'taskCount')
      .addSelect(`COUNT(*) FILTER (WHERE t.status = 'done')::int`, 'doneCount')
      .addSelect(`COUNT(*) FILTER (WHERE t.status = 'failed')::int`, 'failedCount')
      .addSelect(`MAX(t.completedAt) FILTER (WHERE t.status = 'done')`, 'lastPublishedAt')
      .where('t.contentId IN (:...ids)', { ids })
      .groupBy('t.contentId')
      .getRawMany<{
        contentId: string
        taskCount: number
        doneCount: number
        failedCount: number
        lastPublishedAt: Date | null
      }>()

    for (const r of rows) {
      map.set(r.contentId, {
        taskCount: r.taskCount,
        doneCount: r.doneCount,
        failedCount: r.failedCount,
        lastPublishedAt: r.lastPublishedAt ? new Date(r.lastPublishedAt).toISOString() : null,
      })
    }
    return map
  }
}

function emptySummary(): PublishSummary {
  return { taskCount: 0, doneCount: 0, failedCount: 0, lastPublishedAt: null }
}

/**
 * DTO 允许用 null 表示「把这个字段清空」，实体类型里却只有 string | undefined。
 * 在可空列上两者是同一件事，差异只存在于类型层面。
 */
function toEntity(dto: CreateContentDto | UpdateContentDto): Partial<Content> {
  return dto as Partial<Content>
}
