import { MetricsScheduler } from './metrics.scheduler'
import type { FindOperator } from 'typeorm'
import type { Post } from '../posts/post.entity'
import type { Account } from '../accounts/account.entity'

function post(over: Partial<Post>): Post {
  return { id: 'p1', accountId: 'a1', platformPostId: 'v1', ...over } as Post
}

function build(opts: {
  stale?: Post[]
  accounts?: Partial<Account>[]
  metrics?: Record<string, unknown> | null
  adapter?: unknown
}) {
  const accountRepo = {
    findBy: jest.fn().mockResolvedValue(opts.accounts ?? [{ id: 'a1', platform: 'tiktok' }]),
  }
  const accounts = { updateStats: jest.fn() }
  const posts = {
    findStale: jest.fn().mockResolvedValue(opts.stale ?? []),
    saveMetrics: jest.fn(),
    markAttempted: jest.fn(),
  }
  const analytics = { snapshotIfDue: jest.fn().mockResolvedValue(true) }
  const adapter = opts.adapter === undefined
    ? {
        fetchPostMetrics: jest.fn().mockResolvedValue(
          opts.metrics === undefined ? { views: 1, likes: 2, comments: 3, shares: 4 } : opts.metrics,
        ),
        fetchStats: jest.fn().mockResolvedValue({ followers: 9, following: 8, postsCount: 7 }),
      }
    : opts.adapter
  const platforms = { getAdapter: jest.fn().mockReturnValue(adapter) }

  const scheduler = new MetricsScheduler(
    accountRepo as never, accounts as never, posts as never,
    analytics as never, platforms as never,
  )
  return { scheduler, accountRepo, accounts, posts, analytics, platforms, adapter }
}

/** sweep 内部按条 sleep 限流，实时跑会把用例拖到几秒 */
async function run(sweep: Promise<void>) {
  await jest.runAllTimersAsync()
  await sweep
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('sweepPosts', () => {
  it('拉到指标就写回', async () => {
    const t = build({ stale: [post({})] })
    await run(t.scheduler.sweepPosts())

    expect(t.posts.saveMetrics).toHaveBeenCalledWith('p1', {
      views: 1, likes: 2, comments: 3, shares: 4,
    })
    expect(t.posts.markAttempted).not.toHaveBeenCalled()
  })

  // 不盖时间戳的话这条会永远排在「没拉过」最前面，每轮占着名额把后面的饿死
  it('拉不到指标也要盖一次时间戳', async () => {
    const t = build({ stale: [post({})], metrics: null })
    await run(t.scheduler.sweepPosts())

    expect(t.posts.saveMetrics).not.toHaveBeenCalled()
    expect(t.posts.markAttempted).toHaveBeenCalledWith('p1')
  })

  it('账号已被删或平台没适配器时不写 0，只记一次尝试', async () => {
    const t = build({ stale: [post({})], adapter: null })
    await run(t.scheduler.sweepPosts())

    expect(t.posts.saveMetrics).not.toHaveBeenCalled()
    expect(t.posts.markAttempted).toHaveBeenCalledWith('p1')
  })

  it('单条失败不影响同批其余作品', async () => {
    const t = build({ stale: [post({ id: 'p1' }), post({ id: 'p2' })] })
    ;(t.adapter as { fetchPostMetrics: jest.Mock }).fetchPostMetrics
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ views: 5, likes: 0, comments: 0, shares: 0 })

    await run(t.scheduler.sweepPosts())

    expect(t.posts.markAttempted).toHaveBeenCalledWith('p1')
    expect(t.posts.saveMetrics).toHaveBeenCalledWith('p2', expect.objectContaining({ views: 5 }))
  })

  // 作品多时一轮可能超过调度间隔，重入会把同一批打两遍
  it('上一轮还没跑完就跳过', async () => {
    const t = build({ stale: [post({})] })
    const first = t.scheduler.sweepPosts()
    const second = t.scheduler.sweepPosts()
    await run(Promise.all([first, second]).then(() => undefined))

    expect(t.posts.findStale).toHaveBeenCalledTimes(1)
  })

  it('查询异常被吞掉，后台任务不该让进程挂掉', async () => {
    const t = build({})
    t.posts.findStale.mockRejectedValue(new Error('db down'))
    await expect(run(t.scheduler.sweepPosts())).resolves.toBeUndefined()
  })
})

describe('sweepAccounts', () => {
  it('把拉到的统计写回账号并尝试留快照', async () => {
    const t = build({ accounts: [{ id: 'a1', platform: 'tiktok' }] })
    await run(t.scheduler.sweepAccounts())

    expect(t.accounts.updateStats).toHaveBeenCalledWith('a1', {
      followers: 9, following: 8, postsCount: 7,
    })
    // 快照要用刚拉到的粉丝数，不能用库里那份旧的
    expect(t.analytics.snapshotIfDue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', followers: 9 }),
      expect.any(Number),
    )
  })

  // 封禁账号怎么查都是失败，放进来只是每轮白打一遍接口
  it('封禁账号被排除在这一轮之外', async () => {
    const t = build({})
    await run(t.scheduler.sweepAccounts())

    const where = t.accountRepo.findBy.mock.calls[0][0] as { status: FindOperator<string> }
    expect(where.status.type).toBe('not')
    expect(where.status.value).toBe('banned')
  })
})
