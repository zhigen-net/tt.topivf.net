import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Content } from './content.entity'
import { PublishTask } from '../tasks/publish-task.entity'
import { CreateContentDto } from './dto/create-content.dto'
import { UpdateContentDto } from './dto/update-content.dto'
import { QueryContentsDto } from './dto/query-contents.dto'
import type { ReviewAction } from './dto/review-content.dto'
import type { Platform } from '../accounts/account.entity'
import type { User } from '../users/user.entity'

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
    const { search, type, platform, reviewStatus, sort = 'createdAt', order = 'DESC', page = 1, limit = 20 } = query

    const qb = this.repo.createQueryBuilder('c')
    if (search) {
      qb.andWhere('(c.title ILIKE :search OR c.caption ILIKE :search)', { search: `%${search}%` })
    }
    if (type) qb.andWhere('c.type = :type', { type })
    if (platform) qb.andWhere(':platform = ANY(c.platforms)', { platform })
    if (reviewStatus) qb.andWhere('c.reviewStatus = :reviewStatus', { reviewStatus })

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

  async create(dto: CreateContentDto, actor: User) {
    return this.repo.save(this.repo.create({
      ...toEntity(dto),
      hashtags: dto.hashtags ?? [],
      reviewStatus: 'draft',
      createdById: actor.id,
      createdBy: actor.displayName,
    }))
  }

  async update(id: string, dto: UpdateContentDto, actor: User) {
    const content = await this.findOne(id)
    this.assertCanEdit(content, actor)
    await this.repo.update(id, { ...toEntity(dto), ...resetReview(content) })
    return this.findOne(id)
  }

  async remove(id: string, actor: User) {
    const content = await this.findOne(id)
    this.assertCanEdit(content, actor)
    await this.repo.delete(id)
  }

  async bulkRemove(ids: string[], actor: User) {
    const items = await this.repo.findBy({ id: In(ids) })
    for (const c of items) this.assertCanEdit(c, actor)
    const res = await this.repo.delete(items.map((c) => c.id))
    return { deleted: res.affected ?? 0 }
  }

  async bulkSetPlatforms(ids: string[], platforms: Platform[], actor: User) {
    const items = await this.repo.findBy({ id: In(ids) })
    for (const c of items) this.assertCanEdit(c, actor)
    let updated = 0
    for (const c of items) {
      await this.repo.update(c.id, { platforms, ...resetReview(c) })
      updated++
    }
    return { updated }
  }

  /** 草稿或被驳回的作品送去审核 */
  async submit(id: string, actor: User) {
    const content = await this.findOne(id)
    this.assertCanEdit(content, actor)
    if (content.reviewStatus === 'pending') throw new BadRequestException('已经在审核中了')
    if (content.reviewStatus === 'approved') throw new BadRequestException('已经审核通过，无需重复提交')

    await this.repo.update(id, {
      reviewStatus: 'pending',
      ...CLEAR_REVIEW,
    })
    return this.findOne(id)
  }

  async review(id: string, action: ReviewAction, note: string | undefined, actor: User) {
    const content = await this.findOne(id)
    if (content.reviewStatus !== 'pending') throw new BadRequestException('只有待审核的作品可以审核')
    await this.applyReview([content.id], action, note, actor)
    return this.findOne(id)
  }

  async bulkSubmit(ids: string[], actor: User) {
    const items = await this.repo.findBy({ id: In(ids) })
    const usable = items.filter((c) => c.reviewStatus === 'draft' || c.reviewStatus === 'rejected')
    for (const c of usable) this.assertCanEdit(c, actor)
    if (usable.length > 0) {
      await this.repo.update(usable.map((c) => c.id), {
        reviewStatus: 'pending',
        reviewNote: undefined,
        reviewedAt: undefined,
        reviewedBy: undefined,
      })
    }
    return { submitted: usable.length, skipped: items.length - usable.length }
  }

  async bulkReview(ids: string[], action: ReviewAction, note: string | undefined, actor: User) {
    const items = await this.repo.findBy({ id: In(ids) })
    const usable = items.filter((c) => c.reviewStatus === 'pending')
    await this.applyReview(usable.map((c) => c.id), action, note, actor)
    return { reviewed: usable.length, skipped: items.length - usable.length }
  }

  private async applyReview(ids: string[], action: ReviewAction, note: string | undefined, actor: User) {
    if (ids.length === 0) return
    await this.repo.update(ids, {
      reviewStatus: action === 'approve' ? 'approved' : 'rejected',
      reviewNote: action === 'reject' ? note : null,
      reviewedAt: new Date(),
      reviewedBy: actor.displayName,
    } as Partial<Content>)
  }

  /** 普通用户只能动自己建的作品；没有归属的历史数据只有管理员能动 */
  private assertCanEdit(content: Content, actor: User) {
    if (actor.role === 'admin') return
    if (content.createdById !== actor.id) throw new ForbiddenException('只能操作自己创建的作品')
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

/**
 * 审核是针对某一版内容的。改过之后原来的结论就不作数了，退回草稿重走流程，
 * 否则可以先拿一版无害内容过审、再改成别的直接发。
 */
function resetReview(content: Content): Partial<Content> {
  if (content.reviewStatus === 'draft') return {}
  return { reviewStatus: 'draft', ...CLEAR_REVIEW }
}

// TypeORM 的 update 会跳过值为 undefined 的字段，要真的清空必须显式给 null
const CLEAR_REVIEW = {
  reviewNote: null,
  reviewedAt: null,
  reviewedBy: null,
} as unknown as Partial<Content>

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
