import { ForbiddenException, Injectable } from '@nestjs/common'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiKey, McpScope } from '../auth/api-key.entity'
import type { User } from '../users/user.entity'
import { ContentsService } from '../contents/contents.service'
import { AccountsService } from '../accounts/accounts.service'
import { TasksService } from '../tasks/tasks.service'
import { AnalyticsService } from '../analytics/analytics.service'
import { AssetsService, type AssetView } from '../assets/assets.service'
import { CONTENT_TYPES, PLATFORMS } from '../contents/dto/create-content.dto'
import { REVIEW_STATUSES } from '../contents/dto/review-content.dto'
import type { Account } from '../accounts/account.entity'
import type { Content } from '../contents/content.entity'
import type { PublishTask } from '../tasks/publish-task.entity'
import type { WorkspaceContext } from '../workspaces/workspace-context'

const SERVER_INFO = { name: 'socialhub', version: '1.0.0' }

type ToolResult = { content: { type: 'text'; text: string }[] }

/** 密钥的空间在签发时就钉死了，工具里的每次查询都要带上它 */
export interface McpContext {
  key: ApiKey
  user: User
  ws: WorkspaceContext
}

@Injectable()
export class McpService {
  constructor(
    private readonly contents: ContentsService,
    private readonly accounts: AccountsService,
    private readonly tasks: TasksService,
    private readonly analytics: AnalyticsService,
    private readonly assets: AssetsService,
  ) {}

  build(ctx: McpContext): McpServer {
    const server = new McpServer(SERVER_INFO)
    const has = (scope: McpScope) => ctx.key.scopes.includes(scope)

    if (has('assets:read')) this.registerAssetsRead(server, ctx)
    if (has('assets:write')) this.registerAssetsWrite(server, ctx)
    if (has('contents:read')) this.registerContentsRead(server, ctx)
    if (has('contents:write')) this.registerContentsWrite(server, ctx)
    if (has('contents:review')) this.registerContentsReview(server, ctx)
    if (has('accounts:read')) this.registerAccountsRead(server, ctx)
    if (has('tasks:read')) this.registerTasksRead(server, ctx)
    if (has('tasks:publish')) this.registerTasksPublish(server, ctx)
    if (has('analytics:read')) this.registerAnalyticsRead(server, ctx)

    return server
  }

  private registerAssetsRead(server: McpServer, { ws }: McpContext) {
    server.registerTool('list_assets', {
      title: '查询素材库',
      description: '列出工作空间里已上传的图片和视频，拿到的 id 可以直接挂到作品的 assetId 上。',
      inputSchema: {
        type: z.enum(['video', 'image']).optional(),
        search: z.string().max(200).optional().describe('文件名关键词'),
        unused: z.boolean().optional().describe('只看还没有被任何作品引用的素材'),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    }, async ({ unused, ...args }) => {
      const res = await this.assets.findAll(ws, {
        ...args,
        limit: args.limit ?? 24,
        unreferenced: unused ? 'true' : undefined,
      })
      return json({
        total: res.total,
        page: res.page,
        totalPages: res.totalPages,
        data: res.data.map(assetView),
      })
    })
  }

  private registerAssetsWrite(server: McpServer, { ws, user }: McpContext) {
    server.registerTool('import_asset_from_url', {
      title: '从链接导入素材',
      description: '让服务器去下载一个公网上的图片或视频，存进素材库并返回 id。'
        + '只支持 http/https 的公网地址，内网地址会被拒绝。',
      inputSchema: {
        url: z.string().url().describe('素材文件的公网直链，要能直接下到文件本身'),
      },
    }, async ({ url }) => json(assetView(await this.assets.importFromUrl(url, ws, user))))
  }

  private registerContentsRead(server: McpServer, { ws }: McpContext) {
    server.registerTool('list_contents', {
      title: '查询作品',
      description: '按条件分页查询作品库，返回标题、平台、审核状态与发布情况。',
      inputSchema: {
        search: z.string().max(200).optional().describe('标题或文案关键词'),
        type: z.enum(CONTENT_TYPES).optional(),
        platform: z.enum(PLATFORMS).optional(),
        reviewStatus: z.enum(REVIEW_STATUSES).optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    }, async (args) => {
      const res = await this.contents.findAll(ws.id, args)
      return json({
        total: res.total,
        page: res.page,
        totalPages: res.totalPages,
        data: res.data.map(contentView),
      })
    })

    server.registerTool('get_content', {
      title: '查看作品详情',
      description: '按 ID 读取单个作品的完整信息。',
      inputSchema: { id: z.string().uuid() },
    }, async ({ id }) => json(contentView(await this.contents.findOne(id, ws.id))))
  }

  private registerContentsWrite(server: McpServer, { ws, user }: McpContext) {
    server.registerTool('create_content', {
      title: '创建作品',
      description: '新建一个作品，创建后处于草稿状态，需要先提交审核、通过后才能发布。',
      inputSchema: {
        title: z.string().max(200),
        type: z.enum(CONTENT_TYPES),
        platforms: z.array(z.enum(PLATFORMS)).min(1).describe('计划投放的平台'),
        caption: z.string().max(5000).optional().describe('正文文案'),
        hashtags: z.array(z.string().max(100)).optional(),
        assetId: z.string().uuid().optional().describe('素材库里的正片 id，优先用它而不是 fileUrl'),
        thumbnailAssetId: z.string().uuid().optional().describe('素材库里的封面 id'),
        fileUrl: z.string().url().optional().describe('外链素材地址，没进素材库时才用'),
        thumbnailUrl: z.string().url().optional().describe('外链封面地址'),
        duration: z.number().int().min(0).optional().describe('视频时长（秒）'),
      },
    }, async (args) => json(contentView(await this.contents.create(args, ws, user))))

    server.registerTool('update_content', {
      title: '修改作品',
      description: '修改作品内容。注意：改动会让已有的审核结论作废、作品退回草稿状态。',
      inputSchema: {
        id: z.string().uuid(),
        title: z.string().max(200).optional(),
        type: z.enum(CONTENT_TYPES).optional(),
        platforms: z.array(z.enum(PLATFORMS)).min(1).optional(),
        caption: z.string().max(5000).optional(),
        hashtags: z.array(z.string().max(100)).optional(),
        assetId: z.string().uuid().optional(),
        thumbnailAssetId: z.string().uuid().optional(),
        fileUrl: z.string().url().optional(),
        thumbnailUrl: z.string().url().optional(),
        duration: z.number().int().min(0).optional(),
      },
    }, async ({ id, ...patch }) => json(contentView(await this.contents.update(id, patch, ws))))

    server.registerTool('submit_content', {
      title: '提交审核',
      description: '把草稿或被驳回的作品送去审核。',
      inputSchema: { id: z.string().uuid() },
    }, async ({ id }) => json(contentView(await this.contents.submit(id, ws))))
  }

  private registerContentsReview(server: McpServer, { ws, user }: McpContext) {
    server.registerTool('review_content', {
      title: '审核作品',
      description: '通过或驳回一个待审核的作品。驳回时应给出理由。',
      inputSchema: {
        id: z.string().uuid(),
        action: z.enum(['approve', 'reject']),
        note: z.string().max(1000).optional().describe('驳回理由'),
      },
    }, async ({ id, action, note }) => (
      json(contentView(await this.contents.review(id, action, note, ws, user)))
    ))
  }

  private registerAccountsRead(server: McpServer, { ws, key }: McpContext) {
    server.registerTool('list_accounts', {
      title: '查询社交账号',
      description: '列出这把密钥可操作的社交账号。返回值不含任何登录凭证。',
      inputSchema: {
        platform: z.enum(PLATFORMS).optional(),
        status: z.enum(['active', 'inactive', 'banned', 'warming']).optional(),
        search: z.string().max(200).optional().describe('用户名关键词'),
      },
    }, async (args) => {
      const list = key.accountIds
        ? await this.accounts.findAllByIds(key.accountIds, ws.id)
        : (await this.accounts.findAll(ws.id, { ...args, limit: 100 })).data

      const filtered = list.filter((a) => (
        (!args.platform || a.platform === args.platform)
        && (!args.status || a.status === args.status)
        && (!args.search || a.username.toLowerCase().includes(args.search.toLowerCase()))
      ))
      return json({ total: filtered.length, data: filtered.map(accountView) })
    })
  }

  private registerTasksRead(server: McpServer, { ws, key }: McpContext) {
    server.registerTool('list_tasks', {
      title: '查询发布任务',
      description: '查看发布任务的排队、执行与结果情况。',
      inputSchema: {
        contentId: z.string().uuid().optional(),
        accountId: z.string().uuid().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    }, async ({ page = 1, limit = 20, accountId, contentId }) => {
      if (accountId) this.assertAccountsAllowed(key, [accountId])
      const res = await this.tasks.findAll(ws.id, page, limit, accountId, contentId)
      const visible = key.accountIds
        ? res.data.filter((t) => t.accountIds.some((id) => key.accountIds!.includes(id)))
        : res.data
      return json({ total: res.total, page: res.page, data: visible.map(taskView) })
    })
  }

  private registerTasksPublish(server: McpServer, { ws, key }: McpContext) {
    server.registerTool('publish_content', {
      title: '发布作品',
      description: '把一个已通过审核的作品投放到指定账号。可以指定时间来定时发布。',
      inputSchema: {
        contentId: z.string().uuid(),
        accountIds: z.array(z.string().uuid()).min(1).max(100),
        scheduledAt: z.string().datetime().optional().describe('ISO 时间，留空表示立即发布'),
      },
    }, async (args) => {
      this.assertAccountsAllowed(key, args.accountIds)
      return json(taskView(await this.tasks.create(args, ws.id)))
    })
  }

  private registerAnalyticsRead(server: McpServer, { ws, key }: McpContext) {
    server.registerTool('get_account_analytics', {
      title: '查询账号数据趋势',
      description: '读取某个账号最近的粉丝、互动等历史快照。',
      inputSchema: { accountId: z.string().uuid() },
    }, async ({ accountId }) => {
      this.assertAccountsAllowed(key, [accountId])
      return json(await this.analytics.getByAccount(accountId, ws.id))
    })
  }

  /** accountIds 为 null 表示不限空间内账号；空数组表示一个都不许碰 */
  private assertAccountsAllowed(key: ApiKey, ids: string[]) {
    if (!key.accountIds) return
    const denied = ids.filter((id) => !key.accountIds!.includes(id))
    if (denied.length) throw new ForbiddenException(`该密钥无权操作账号：${denied.join(', ')}`)
  }
}

function json(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

// 手写投影而不是直接回实体：MCP 这条链路上没有 ClassSerializerInterceptor，
// @Exclude 不会生效，sessionData 之类的凭证会被原样吐给 AI。
function accountView(a: Account) {
  return {
    id: a.id,
    platform: a.platform,
    username: a.username,
    displayName: a.displayName,
    status: a.status,
    followers: a.followers,
    following: a.following,
    postsCount: a.postsCount,
    lastActiveAt: a.lastActiveAt ?? null,
  }
}

// 不带 url：那是条带签名的直链，没必要留在 AI 的上下文里，挂作品只需要 id
function assetView(a: AssetView) {
  return {
    id: a.id,
    filename: a.filename,
    type: a.type,
    mimeType: a.mimeType,
    size: a.size,
    duration: a.duration,
    referenced: a.referenced,
    createdAt: a.createdAt,
  }
}

function contentView(c: Content) {
  return {
    id: c.id,
    title: c.title,
    type: c.type,
    caption: c.caption ?? null,
    hashtags: c.hashtags,
    platforms: c.platforms,
    assetId: c.assetId ?? null,
    thumbnailAssetId: c.thumbnailAssetId ?? null,
    fileUrl: c.fileUrl ?? null,
    thumbnailUrl: c.thumbnailUrl ?? null,
    duration: c.duration ?? null,
    reviewStatus: c.reviewStatus,
    reviewNote: c.reviewNote ?? null,
    reviewedBy: c.reviewedBy ?? null,
    reviewedAt: c.reviewedAt ?? null,
    createdBy: c.createdBy ?? null,
    createdAt: c.createdAt,
  }
}

function taskView(t: PublishTask) {
  return {
    id: t.id,
    contentId: t.contentId,
    contentTitle: t.content?.title ?? null,
    accountIds: t.accountIds,
    platforms: t.platforms,
    status: t.status,
    scheduledAt: t.scheduledAt,
    completedAt: t.completedAt ?? null,
    results: t.results,
  }
}
