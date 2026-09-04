import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { MetaCredential, PendingTarget } from './meta-credential.entity'
import { Account } from '../accounts/account.entity'
import { SecretBox } from '../crypto/secret-box'
import { FacebookService, type LinkablePage } from '../platforms/facebook/facebook.service'
import { GraphError } from '../platforms/facebook/graph-api'
import { inspectToken } from '../platforms/facebook/token'
import type { LinkTargetDto } from './dto/link-targets.dto'

/** 到期前这么久开始提醒，留出重新生成令牌的时间 */
const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000

export interface DiscoveredTarget extends PendingTarget {
  followers: number
  /** 已经接入成账号的，前端要置灰而不是让用户重复添加 */
  linkedAccountId?: string
}

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name)

  constructor(
    @InjectRepository(MetaCredential) private readonly repo: Repository<MetaCredential>,
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly facebook: FacebookService,
    private readonly secrets: SecretBox,
  ) {}

  async findAll(workspaceId: string) {
    const rows = await this.repo.find({ where: { workspaceId }, order: { createdAt: 'DESC' } })
    const counts = await this.countAccounts(rows.map((r) => r.id))
    return rows.map((c) => present(c, counts.get(c.id) ?? 0))
  }

  async findOne(id: string, workspaceId: string) {
    const credential = await this.repo.findOne({ where: { id, workspaceId } })
    if (!credential) throw new NotFoundException('凭证不存在或不属于当前工作空间')
    return credential
  }

  /** 粘一条令牌，校验、必要时换长期、加密入库 */
  async create(label: string, token: string, workspaceId: string) {
    this.assertEncryptionReady()
    const resolved = await this.facebook.resolveToken(token)
    // 先确认这条令牌真能拉出主页再落库，否则会留下一条建好就不能用的凭证
    const pages = await this.facebook.fetchPages(resolved.token)

    const credential = await this.repo.save(
      this.repo.create({
        workspaceId,
        label: label.trim(),
        appId: resolved.info.appId,
        tokenType: resolved.info.type,
        scopes: resolved.info.scopes,
        expiresAt: resolved.expiresAt,
        encryptedToken: this.secrets.encrypt(resolved.token),
        status: statusFor(resolved.expiresAt),
        lastCheckedAt: new Date(),
        pendingTargets: toTargets(pages),
      }),
    )

    this.logger.log(`凭证「${credential.label}」已创建，名下 ${pages.length} 个主页`)
    return {
      credential: present(credential, 0),
      targets: await this.decorate(toTargets(pages), pages, workspaceId),
    }
  }

  /** 用存的令牌重新拉一次，标出哪些已接入、哪些是新的 */
  async discover(id: string, workspaceId: string): Promise<DiscoveredTarget[]> {
    const credential = await this.findOne(id, workspaceId)
    const pages = await this.withHealthTracking(credential, (token) =>
      this.facebook.fetchPages(token),
    )

    const targets = toTargets(pages)
    const decorated = await this.decorate(targets, pages, workspaceId)

    // 只把没接入的记成待处理，前端红点才不会一直亮着
    credential.pendingTargets = decorated
      .filter((t) => !t.linkedAccountId)
      .map(({ followers: _f, linkedAccountId: _l, ...rest }) => rest)
    await this.repo.save(credential)

    return decorated
  }

  /** 批量把选中的主页 / IG 账号建成账号，全部挂到这条凭证下 */
  async link(id: string, targets: LinkTargetDto[], workspaceId: string) {
    const credential = await this.findOne(id, workspaceId)
    const pages = await this.withHealthTracking(credential, (token) =>
      this.facebook.fetchPages(token),
    )

    const created: Account[] = []
    const skipped: string[] = []

    for (const target of targets) {
      const found = locate(pages, target)
      if (!found) {
        skipped.push(`${target.externalId}（在该凭证下已找不到）`)
        continue
      }
      const exists = await this.accounts.findOneBy({
        workspaceId,
        platform: target.platform,
        externalId: target.externalId,
      })
      if (exists) {
        skipped.push(`${found.username}（已接入）`)
        continue
      }
      created.push(await this.accounts.save(this.accounts.create({
        workspaceId,
        credentialId: credential.id,
        platform: target.platform,
        externalId: target.externalId,
        username: found.username,
        displayName: found.displayName,
        avatar: found.avatar,
        status: 'active',
        followers: found.followers,
        postsCount: found.postsCount,
        sessionData: found.sessionData,
      })))
    }

    await this.discover(id, workspaceId)
    this.logger.log(`凭证「${credential.label}」接入 ${created.length} 个账号，跳过 ${skipped.length} 个`)
    // 只回必要字段：账号实体带着 sessionData，那是主页令牌
    return {
      created: created.length,
      skipped,
      accounts: created.map((a) => ({ id: a.id, platform: a.platform, username: a.username })),
    }
  }

  /** 用存的令牌重签所有下挂账号的主页凭证，权限变更或主页令牌失效后用 */
  async refresh(id: string, workspaceId: string) {
    const credential = await this.findOne(id, workspaceId)
    const pages = await this.withHealthTracking(credential, (token) =>
      this.facebook.fetchPages(token),
    )
    return this.applyToAccounts(credential, pages, workspaceId)
  }

  /**
   * 换一条新令牌。旧令牌到期或权限补齐后走这里，按 externalId 匹配，
   * 用户不用挨个账号重新绑定。
   */
  async rotate(id: string, token: string, workspaceId: string) {
    this.assertEncryptionReady()
    const credential = await this.findOne(id, workspaceId)
    const resolved = await this.facebook.resolveToken(token)
    const pages = await this.facebook.fetchPages(resolved.token)

    Object.assign(credential, {
      appId: resolved.info.appId,
      tokenType: resolved.info.type,
      scopes: resolved.info.scopes,
      expiresAt: resolved.expiresAt,
      encryptedToken: this.secrets.encrypt(resolved.token),
      status: statusFor(resolved.expiresAt),
      lastCheckedAt: new Date(),
      lastError: null as unknown as undefined,
    })
    await this.repo.save(credential)

    const result = await this.applyToAccounts(credential, pages, workspaceId)
    this.logger.log(`凭证「${credential.label}」已换新令牌，更新 ${result.updated} 个账号`)
    return result
  }

  async remove(id: string, workspaceId: string) {
    const credential = await this.findOne(id, workspaceId)
    // 账号上的 credential_id 会被置空，但主页凭证还在 sessionData 里，账号照常能发
    await this.repo.remove(credential)
  }

  /** 巡检：确认令牌还活着，并把新出现的主页记成待接入 */
  async check(credential: MetaCredential) {
    try {
      const token = this.secrets.decrypt(credential.encryptedToken)
      const info = await inspectToken(token)
      const pages = await this.facebook.fetchPages(token)
      const decorated = await this.decorate(toTargets(pages), pages, credential.workspaceId)

      Object.assign(credential, {
        tokenType: info.type,
        scopes: info.scopes,
        expiresAt: info.expiresAt,
        status: statusFor(info.expiresAt),
        lastCheckedAt: new Date(),
        lastError: null as unknown as undefined,
        pendingTargets: decorated
          .filter((t) => !t.linkedAccountId)
          .map(({ followers: _f, linkedAccountId: _l, ...rest }) => rest),
      })
      return this.repo.save(credential)
    } catch (err) {
      return this.markUnhealthy(credential, err)
    }
  }

  /** 把主页列表落到账号上；externalId 对不上的账号会被点名，通常是主页被移出了资产 */
  private async applyToAccounts(
    credential: MetaCredential,
    pages: LinkablePage[],
    workspaceId: string,
  ) {
    const accounts = await this.accounts.findBy({ credentialId: credential.id, workspaceId })
    const byId = indexTargets(pages)

    let updated = 0
    const orphaned: string[] = []

    for (const account of accounts) {
      const found = account.externalId ? byId.get(account.externalId) : undefined
      if (!found) {
        orphaned.push(account.username)
        continue
      }
      account.sessionData = found.sessionData
      account.followers = found.followers
      account.postsCount = found.postsCount
      await this.accounts.save(account)
      updated++
    }

    if (orphaned.length) {
      this.logger.warn(`凭证「${credential.label}」下这些账号在新令牌里找不到: ${orphaned.join(', ')}`)
    }
    return { updated, orphaned }
  }

  /** 解密取令牌跑一次调用，顺带把成败记到凭证健康状态上 */
  private async withHealthTracking<T>(
    credential: MetaCredential,
    fn: (token: string) => Promise<T>,
  ): Promise<T> {
    const token = this.secrets.decrypt(credential.encryptedToken)
    try {
      const result = await fn(token)
      if (credential.status === 'invalid') {
        credential.status = statusFor(credential.expiresAt)
        credential.lastError = undefined
        await this.repo.save(credential)
      }
      return result
    } catch (err) {
      await this.markUnhealthy(credential, err)
      throw err
    }
  }

  private async markUnhealthy(credential: MetaCredential, err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // 限流是暂时的，据此标失效会让用户以为要重新绑定
    const transient = err instanceof GraphError && err.isRateLimit
    Object.assign(credential, {
      status: transient ? credential.status : 'invalid',
      lastCheckedAt: new Date(),
      lastError: message,
    })
    if (!transient) this.logger.warn(`凭证「${credential.label}」已失效: ${message}`)
    return this.repo.save(credential)
  }

  private async decorate(
    targets: PendingTarget[],
    pages: LinkablePage[],
    workspaceId: string,
  ): Promise<DiscoveredTarget[]> {
    const ids = targets.map((t) => t.externalId)
    const linked = ids.length
      ? await this.accounts.findBy({ workspaceId, externalId: In(ids) })
      : []
    const byExternalId = new Map(linked.map((a) => [a.externalId as string, a.id]))
    const stats = indexTargets(pages)

    return targets.map((t) => ({
      ...t,
      followers: stats.get(t.externalId)?.followers ?? 0,
      linkedAccountId: byExternalId.get(t.externalId),
    }))
  }

  private async countAccounts(ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map()
    const rows = await this.accounts
      .createQueryBuilder('a')
      .select('a.credential_id', 'id')
      .addSelect('COUNT(*)', 'count')
      .where('a.credential_id IN (:...ids)', { ids })
      .groupBy('a.credential_id')
      .getRawMany<{ id: string; count: string }>()
    return new Map(rows.map((r) => [r.id, Number(r.count)]))
  }

  private assertEncryptionReady() {
    if (!this.secrets.enabled) {
      throw new BadRequestException(
        '未配置 CREDENTIAL_ENCRYPTION_KEY，无法托管令牌。请先在服务端配置该密钥并重启。',
      )
    }
  }
}

interface ResolvedTarget {
  username: string
  displayName: string
  avatar?: string
  followers: number
  postsCount: number
  sessionData: Record<string, string>
}

/** 一个主页可能同时产出一条 facebook 目标和一条 instagram 目标 */
function toTargets(pages: LinkablePage[]): PendingTarget[] {
  return pages.flatMap((p) => {
    const own: PendingTarget = {
      platform: 'facebook',
      externalId: p.pageId,
      username: p.name,
      displayName: p.name,
      avatar: p.avatar,
    }
    if (!p.instagram) return [own]
    return [own, {
      platform: 'instagram' as const,
      externalId: p.instagram.igUserId,
      username: p.instagram.username,
      displayName: p.instagram.username,
      avatar: p.instagram.avatar,
    }]
  })
}

function indexTargets(pages: LinkablePage[]): Map<string, ResolvedTarget> {
  const map = new Map<string, ResolvedTarget>()
  for (const p of pages) {
    map.set(p.pageId, {
      username: p.name,
      displayName: p.name,
      avatar: p.avatar,
      followers: p.followers,
      postsCount: 0,
      sessionData: { pageId: p.pageId, pageAccessToken: p.accessToken },
    })
    if (p.instagram) {
      map.set(p.instagram.igUserId, {
        username: p.instagram.username,
        displayName: p.instagram.username,
        avatar: p.instagram.avatar,
        followers: p.instagram.followers,
        postsCount: p.instagram.postsCount,
        sessionData: { igUserId: p.instagram.igUserId, pageAccessToken: p.accessToken },
      })
    }
  }
  return map
}

function locate(pages: LinkablePage[], target: LinkTargetDto): ResolvedTarget | undefined {
  const found = indexTargets(pages).get(target.externalId)
  if (!found) return undefined
  // 平台对不上说明前端把 pageId 当成了 igUserId，照发会拿错 id
  const isInstagram = 'igUserId' in found.sessionData
  return isInstagram === (target.platform === 'instagram') ? found : undefined
}

/**
 * 显式挑字段，不要展开实体。`{...credential}` 会退化成普通对象，
 * ClassSerializerInterceptor 的 @Exclude 就不生效了，加密令牌会直接漏进响应。
 */
function present(c: MetaCredential, accountCount: number) {
  return {
    id: c.id,
    label: c.label,
    appId: c.appId,
    tokenType: c.tokenType,
    scopes: c.scopes,
    expiresAt: Number(c.expiresAt),
    status: c.status,
    lastCheckedAt: c.lastCheckedAt,
    lastError: c.lastError,
    pendingTargets: c.pendingTargets,
    createdAt: c.createdAt,
    accountCount,
  }
}

export function statusFor(expiresAt: number): MetaCredential['status'] {
  if (!expiresAt) return 'active'
  const remaining = expiresAt * 1000 - Date.now()
  if (remaining <= 0) return 'invalid'
  return remaining < EXPIRING_SOON_MS ? 'expiring' : 'active'
}
