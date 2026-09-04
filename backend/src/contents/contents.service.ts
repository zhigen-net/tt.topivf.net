import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Content } from './content.entity'
import { Asset } from '../assets/asset.entity'
import { AssetsService } from '../assets/assets.service'
import { PublishTask } from '../tasks/publish-task.entity'
import { CreateContentDto } from './dto/create-content.dto'
import { UpdateContentDto } from './dto/update-content.dto'
import { QueryContentsDto } from './dto/query-contents.dto'
import type { ReviewAction } from './dto/review-content.dto'
import type { Platform } from '../accounts/account.entity'
import type { User } from '../users/user.entity'
import type { WorkspaceContext } from '../workspaces/workspace-context'

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
    @InjectRepository(Asset) private assets: Repository<Asset>,
    private readonly assetsService: AssetsService,
  ) {}

  async findAll(workspaceId: string, query: QueryContentsDto) {
    const { search, type, platform, reviewStatus, sort = 'createdAt', order = 'DESC', page = 1, limit = 20 } = query

    const qb = this.repo.createQueryBuilder('c').where('c.workspaceId = :workspaceId', { workspaceId })
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
    const thumbs = await this.assetsService.signedUrlsFor(
      data.map((c) => c.thumbnailAssetId).filter((id): id is string => !!id),
    )
    // 没单独设封面的作品，退而用配图本身当封面
    const covers = await this.assetsService.signedImageUrlsFor(
      data.filter((c) => !c.thumbnailUrl && !c.thumbnailAssetId)
        .map((c) => c.assetId)
        .filter((id): id is string => !!id),
    )

    return {
      data: data.map((c) => Object.assign(c, summaries.get(c.id) ?? emptySummary(), {
        coverUrl: coverUrlOf(c, thumbs, covers),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findOne(id: string, workspaceId: string) {
    const item = await this.repo.findOneBy({ id, workspaceId })
    if (!item) throw new NotFoundException(`Content ${id} not found`)
    return item
  }

  async create(dto: CreateContentDto, ws: WorkspaceContext, actor: User) {
    await this.assertAssetsInWorkspace(dto, ws.id)
    return this.repo.save(this.repo.create({
      ...toEntity(dto),
      hashtags: dto.hashtags ?? [],
      reviewStatus: 'draft',
      workspaceId: ws.id,
      createdById: actor.id,
      createdBy: actor.displayName,
    }))
  }

  async update(id: string, dto: UpdateContentDto, ws: WorkspaceContext) {
    const content = await this.findOne(id, ws.id)
    await this.assertAssetsInWorkspace(dto, ws.id)
    await this.repo.update(id, { ...toEntity(dto), ...resetReview(content) })
    return this.findOne(id, ws.id)
  }

  async remove(id: string, ws: WorkspaceContext) {
    const content = await this.findOne(id, ws.id)
    await this.assertCanDelete(content, ws)
    await this.repo.delete(id)
  }

  async bulkRemove(ids: string[], ws: WorkspaceContext) {
    const items = await this.repo.findBy({ id: In(ids), workspaceId: ws.id })
    for (const c of items) await this.assertCanDelete(c, ws)
    if (!items.length) return { deleted: 0 }
    const res = await this.repo.delete(items.map((c) => c.id))
    return { deleted: res.affected ?? 0 }
  }

  async bulkSetPlatforms(ids: string[], platforms: Platform[], ws: WorkspaceContext) {
    const items = await this.repo.findBy({ id: In(ids), workspaceId: ws.id })
    let updated = 0
    for (const c of items) {
      await this.repo.update(c.id, { platforms, ...resetReview(c) })
      updated++
    }
    return { updated }
  }

  /** 草稿或被驳回的作品送去审核 */
  async submit(id: string, ws: WorkspaceContext) {
    const content = await this.findOne(id, ws.id)
    if (content.reviewStatus === 'pending') throw new BadRequestException('已经在审核中了')
    if (content.reviewStatus === 'approved') throw new BadRequestException('已经审核通过，无需重复提交')

    await this.repo.update(id, {
      reviewStatus: 'pending',
      ...CLEAR_REVIEW,
    })
    return this.findOne(id, ws.id)
  }

  async review(id: string, action: ReviewAction, note: string | undefined, ws: WorkspaceContext, actor: User) {
    const content = await this.findOne(id, ws.id)
    if (content.reviewStatus !== 'pending') throw new BadRequestException('只有待审核的作品可以审核')
    await this.applyReview([content.id], action, note, actor)
    return this.findOne(id, ws.id)
  }

  async bulkSubmit(ids: string[], ws: WorkspaceContext) {
    const items = await this.repo.findBy({ id: In(ids), workspaceId: ws.id })
    const usable = items.filter((c) => c.reviewStatus === 'draft' || c.reviewStatus === 'rejected')
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

  async bulkReview(ids: string[], action: ReviewAction, note: string | undefined, ws: WorkspaceContext, actor: User) {
    const items = await this.repo.findBy({ id: In(ids), workspaceId: ws.id })
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

  /** 素材 id 来自请求体，不验一遍就能把别的空间的素材挂到自己作品上 */
  private async assertAssetsInWorkspace(dto: CreateContentDto | UpdateContentDto, workspaceId: string) {
    const ids = [dto.assetId, dto.thumbnailAssetId].filter((id): id is string => !!id)
    if (!ids.length) return
    const found = await this.assets.countBy({ id: In([...new Set(ids)]), workspaceId })
    if (found !== new Set(ids).size) {
      throw new NotFoundException('素材不存在或不属于当前工作空间')
    }
  }

  /**
   * 成员只能删草稿和被驳回的作品，且不能已被发布任务引用过——
   * 删掉进过审核流或已发出去的作品会让审核记录和发布记录断链。
   */
  private async assertCanDelete(content: Content, ws: WorkspaceContext) {
    if (ws.role === 'manager') return
    if (content.reviewStatus !== 'draft' && content.reviewStatus !== 'rejected') {
      throw new ForbiddenException('只有草稿和已驳回的作品可以由成员删除')
    }
    if (await this.tasks.existsBy({ contentId: content.id })) {
      throw new ForbiddenException('作品已被发布任务引用，需空间管理员删除')
    }
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
 * 列表展示用的封面，和用户真正设的 thumbnailUrl 分开：signedUrl 几分钟就过期，
 * 混进 thumbnailUrl 会被编辑弹窗当成外链回填，一保存就存下一条马上失效的地址。
 */
export function coverUrlOf(
  c: Pick<Content, 'thumbnailUrl' | 'thumbnailAssetId' | 'assetId' | 'fileUrl' | 'type'>,
  thumbs: Map<string, string>,
  covers: Map<string, string>,
): string | undefined {
  if (c.thumbnailUrl) return c.thumbnailUrl
  if (c.thumbnailAssetId) return thumbs.get(c.thumbnailAssetId)
  if (c.assetId) return covers.get(c.assetId)
  // 外链配图只有图片类作品能直接当封面，视频链接塞进 img 是裂图
  return c.type === 'image' ? c.fileUrl : undefined
}

/**
 * DTO 允许用 null 表示「把这个字段清空」，实体类型里却只有 string | undefined。
 * 在可空列上两者是同一件事，差异只存在于类型层面。
 */
function toEntity(dto: CreateContentDto | UpdateContentDto): Partial<Content> {
  return dto as Partial<Content>
}
