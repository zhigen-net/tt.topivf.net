import { CommentsService } from './comments.service'
import type { Comment } from './comment.entity'

function build(
  rows: Partial<Comment>[] = [],
  overrides: Record<string, unknown> = {},
  adapter: Record<string, unknown> = {},
) {
  const insertBuilder = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  }
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(rows.length),
    getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
    ...insertBuilder,
  }
  const repo = {
    update: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn().mockResolvedValue(rows[0] ?? null),
    countBy: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => qb),
    ...overrides,
  }
  const accounts = {
    find: jest.fn().mockResolvedValue([]),
    findBy: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn().mockResolvedValue({
      id: 'acc-1', workspaceId: 'ws-1', platform: 'instagram', displayName: '小号',
    }),
  }
  const replyComment = jest.fn().mockResolvedValue('remote-reply-1')
  const platforms = { getAdapter: jest.fn(() => ({ replyComment, ...adapter })) }
  const ds = { query: jest.fn().mockResolvedValue(undefined) }

  const svc = new CommentsService(
    repo as never, accounts as never, platforms as never, ds as never,
  )
  return { svc, repo, qb, accounts, platforms, replyComment }
}

const WS = { id: 'ws-1' } as never

/**
 * 我们自己发出去的回复也是 comments 表里的一行。漏掉这个过滤，收件箱会把
 * 自己的回复也列成「待处理」，人会一直回自己。
 */
describe('收件箱过滤', () => {
  it('列表永远排除账号自己发的评论', async () => {
    const { svc, qb } = build()
    await svc.findAll('ws-1', {})

    const own = qb.andWhere.mock.calls.find(([sql]: [string]) => sql.includes('fromPage'))
    expect(own?.[0]).toContain('false')
  })

  it('角标计数用和列表一样的口径', async () => {
    const { svc, qb } = build()
    await svc.pendingCount('ws-1')

    const sql = qb.andWhere.mock.calls.map(([s]: [string]) => s).join(' ')
    expect(sql).toContain('fromPage')
    expect(sql).toContain('repliedAt IS NULL')
    expect(sql).toContain('ignoredAt IS NULL')
  })

  // 空数组直接拼进 IN () 是语法错误，会把「一个账号都看不到」变成 500
  it('可见账号为空时用占位 id，不生成空 IN', async () => {
    const { svc, qb } = build()
    await svc.findAll('ws-1', {}, [])

    const scope = qb.andWhere.mock.calls.find(([sql]: [string]) => sql.includes('accountScope'))
    expect(scope?.[1].accountScope).toHaveLength(1)
  })
})

/**
 * repliedAt / ignoredAt 是我们自己维护的人工标记，平台不会回传。
 * 同步时整行覆盖会把它们冲掉，评论就又冒回待处理列表。
 */
describe('同步入库', () => {
  it('已存在的评论不覆盖，靠 orIgnore 跳过', async () => {
    const { svc, qb } = build([], {}, {
      fetchComments: jest.fn().mockResolvedValue([{
        id: 'c1', postId: 'p1', message: '你好', postedAt: new Date(), fromPage: false,
      }]),
    })

    await svc.syncAccount({ id: 'acc-1', workspaceId: 'ws-1', platform: 'instagram' } as never)

    expect(qb.orIgnore).toHaveBeenCalled()
  })

  it('平台读不到时返回 null，不能当成「没有评论」', async () => {
    const { svc } = build([], {}, { fetchComments: jest.fn().mockResolvedValue(null) })

    expect(await svc.syncAccount({ id: 'acc-1', platform: 'instagram' } as never)).toBeNull()
  })
})

describe('回复评论', () => {
  const existing = [{
    id: 'uuid-1', accountId: 'acc-1', workspaceId: 'ws-1',
    platform: 'instagram' as const, platformCommentId: 'ig-99', platformPostId: 'p1',
  }]

  it('发给平台的是平台侧的评论 id，不是我们的 uuid', async () => {
    const { svc, replyComment } = build(existing)
    await svc.reply('uuid-1', '谢谢关注', WS)

    expect(replyComment.mock.calls[0][1]).toBe('ig-99')
  })

  // 平台侧已经发出去了，这时候再抛错会让人以为没发成功，然后再回一条
  it('本地入库失败也不抛错', async () => {
    const { svc } = build(existing, {
      createQueryBuilder: jest.fn(() => { throw new Error('db down') }),
    })

    await expect(svc.reply('uuid-1', '谢谢关注', WS)).resolves.toBeDefined()
  })

  it('回复后清掉忽略标记，免得又被当成不用管', async () => {
    const { svc, repo } = build(existing)
    await svc.reply('uuid-1', '谢谢关注', WS)

    expect(repo.update).toHaveBeenCalledWith('uuid-1', expect.objectContaining({ ignoredAt: null }))
  })
})
