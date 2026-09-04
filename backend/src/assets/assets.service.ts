import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import { extname } from 'path'
import { Asset, type AssetType } from './asset.entity'
import { AssetStorageService } from './asset-storage.service'
import { fetchRemoteFile } from './remote-fetch'
import { QueryAssetsDto } from './dto/asset.dto'
import { Content } from '../contents/content.entity'
import type { User } from '../users/user.entity'
import type { WorkspaceContext } from '../workspaces/workspace-context'

const MIME_TYPES: Record<string, AssetType> = {
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
}

// 上传走内存缓冲，这个上限同时是 multer 的硬闸，超了直接 413
export const ASSET_MAX_SIZE = Number(process.env.ASSET_MAX_SIZE) || 200 * 1024 * 1024

/** 签名读链接的有效期。够页面加载完，短到捡到链接也没什么用 */
const RAW_URL_TTL_MS = 10 * 60 * 1000
const PUBLISH_URL_TTL_MS = 60 * 60 * 1000

/** 浏览器走的是 nginx 的 /api，后端自己的路由树上没有这一段 */
const BROWSER_PREFIX = '/api'

export type AssetView = ReturnType<AssetsService['view']>

@Injectable()
export class AssetsService {
  private readonly secret: string
  private readonly publicBase: string

  constructor(
    @InjectRepository(Asset) private repo: Repository<Asset>,
    @InjectRepository(Content) private contents: Repository<Content>,
    private readonly storage: AssetStorageService,
    cfg: ConfigService,
  ) {
    this.secret = cfg.get('JWT_SECRET') ?? ''
    this.publicBase = (cfg.get<string>('PUBLIC_API_URL') ?? '').replace(/\/$/, '')
  }

  /**
   * 给平台侧用的绝对地址。Facebook 是让 Meta 的服务器自己来拉文件的，
   * 所以这里必须是公网可达的域名，不能是 minio 那个内网地址。
   */
  async publicUrl(assetId: string) {
    const asset = await this.repo.findOneBy({ id: assetId })
    if (!asset) throw new NotFoundException('素材不存在')
    if (!this.publicBase) throw new BadRequestException('未配置 PUBLIC_API_URL，无法发布素材库文件')
    // 平台拉大文件可能慢，给得比页面展示宽松些
    return this.publicBase + this.signedUrl(asset, PUBLISH_URL_TTL_MS)
  }

  async upload(file: Express.Multer.File, ws: WorkspaceContext, actor: User) {
    return this.persist(file.buffer, file.originalname, file.mimetype, ws, actor)
  }

  /** 让服务器去拉一个外部地址，地址可能来自 AI，内网防护在 fetchRemoteFile 里 */
  async importFromUrl(url: string, ws: WorkspaceContext, actor: User) {
    const file = await fetchRemoteFile(url, ASSET_MAX_SIZE)
    return this.persist(file.buffer, file.filename, file.mimeType, ws, actor)
  }

  private async persist(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    ws: WorkspaceContext,
    actor: User,
  ) {
    const type = MIME_TYPES[mimeType]
    if (!type) throw new BadRequestException(`不支持的文件类型：${mimeType || '未知'}`)

    // 键带空间前缀，即便以后有代码漏了过滤，对象层面也不会混在一起
    const objectKey = `${ws.id}/${randomUUID()}${extname(filename).slice(0, 10)}`
    await this.storage.put(objectKey, buffer, mimeType)

    const asset = await this.repo.save(this.repo.create({
      workspaceId: ws.id,
      objectKey,
      filename,
      mimeType,
      size: buffer.length,
      type,
      uploadedById: actor.id,
      uploadedBy: actor.displayName,
    }))
    return this.view(asset, false)
  }

  async findAll(ws: WorkspaceContext, query: QueryAssetsDto) {
    const page = query.page ?? 1
    const limit = query.limit ?? 24

    const qb = this.repo.createQueryBuilder('a')
      .where('a.workspaceId = :workspaceId', { workspaceId: ws.id })
    if (query.type) qb.andWhere('a.type = :type', { type: query.type })
    if (query.search) qb.andWhere('a.filename ILIKE :search', { search: `%${query.search}%` })
    if (query.unreferenced === 'true') {
      qb.andWhere('NOT EXISTS (SELECT 1 FROM contents c WHERE c.asset_id = a.id OR c.thumbnail_asset_id = a.id)')
    }

    const [data, total] = await qb
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()

    const referenced = await this.findReferencedIds(data.map((a) => a.id))
    return {
      data: data.map((a) => this.view(a, referenced.has(a.id))),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async findOne(id: string, ws: WorkspaceContext) {
    const asset = await this.repo.findOneBy({ id, workspaceId: ws.id })
    if (!asset) throw new NotFoundException('素材不存在')
    return asset
  }

  /** 批量取签名直链，给作品列表回填缩略图用 */
  async signedUrlsFor(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map()
    const assets = await this.repo.findBy({ id: In([...new Set(ids)]) })
    return new Map(assets.map((a) => [a.id, BROWSER_PREFIX + this.signedUrl(a)]))
  }

  /** 同上，但只认图片：视频素材塞进 img 标签只会渲染成裂图 */
  async signedImageUrlsFor(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map()
    const assets = await this.repo.findBy({ id: In([...new Set(ids)]), type: 'image' })
    return new Map(assets.map((a) => [a.id, BROWSER_PREFIX + this.signedUrl(a)]))
  }

  async findOneView(id: string, ws: WorkspaceContext) {
    const asset = await this.findOne(id, ws)
    return this.view(asset, (await this.findReferencedIds([id])).has(id))
  }

  async remove(id: string, ws: WorkspaceContext) {
    const asset = await this.findOne(id, ws)
    if ((await this.findReferencedIds([id])).has(id)) {
      throw new ForbiddenException('素材已被作品引用，请先在作品里换掉它')
    }
    await this.repo.delete(asset.id)
    // 先删记录再删对象：反过来失败时会留下一条指向空对象的坏记录
    await this.storage.remove(asset.objectKey)
  }

  /** 校验签名并回流对象内容；这条路没有 JWT，能不能读全看签名 */
  async openSigned(id: string, token: string) {
    const asset = await this.repo.findOneBy({ id })
    if (!asset) throw new NotFoundException('素材不存在')

    const [expRaw, sig] = token.split('.')
    const exp = Number(expRaw)
    if (!sig || !exp || exp < Date.now()) throw new ForbiddenException('链接已过期')
    if (!this.verify(this.payload(asset.id, asset.workspaceId, exp), sig)) {
      throw new ForbiddenException('链接签名无效')
    }

    return { asset, stream: await this.storage.get(asset.objectKey) }
  }

  view(asset: Asset, referenced: boolean) {
    return {
      id: asset.id,
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: Number(asset.size),
      type: asset.type,
      duration: asset.duration ?? null,
      uploadedBy: asset.uploadedBy ?? null,
      createdAt: asset.createdAt,
      referenced,
      url: BROWSER_PREFIX + this.signedUrl(asset),
    }
  }

  private signedUrl(asset: Asset, ttl = RAW_URL_TTL_MS) {
    const exp = Date.now() + ttl
    const sig = createHmac('sha256', this.secret)
      .update(this.payload(asset.id, asset.workspaceId, exp))
      .digest('hex')
    return `/v1/assets/${asset.id}/raw?t=${exp}.${sig}`
  }

  private payload(id: string, workspaceId: string, exp: number) {
    return `${id}.${workspaceId}.${exp}`
  }

  private verify(payload: string, sig: string) {
    // Buffer.from(x, 'hex') 遇到非法字符会静默截断，光比长度的话
    // 在正确签名后面接任意垃圾都能过，这里先卡死格式
    if (!/^[0-9a-f]{64}$/.test(sig)) return false
    const expected = createHmac('sha256', this.secret).update(payload).digest()
    return timingSafeEqual(Buffer.from(sig, 'hex'), expected)
  }

  private async findReferencedIds(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set()
    const rows = await this.contents.find({
      where: [{ assetId: In(ids) }, { thumbnailAssetId: In(ids) }],
      select: { assetId: true, thumbnailAssetId: true },
    })
    const used = new Set<string>()
    for (const row of rows) {
      if (row.assetId) used.add(row.assetId)
      if (row.thumbnailAssetId) used.add(row.thumbnailAssetId)
    }
    return new Set(ids.filter((id) => used.has(id)))
  }
}
