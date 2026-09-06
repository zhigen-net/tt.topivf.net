import { PostsService, MAX_METRIC_FAILS } from './posts.service'
import type { Repository } from 'typeorm'
import type { Post } from './post.entity'

function build(rows: Partial<Post>[] = []) {
  const update = jest.fn().mockResolvedValue(undefined)
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
    getManyAndCount: jest.fn().mockResolvedValue([rows, rows.length]),
  }
  const repo = {
    update,
    createQueryBuilder: jest.fn(() => qb),
  } as unknown as Repository<Post>
  const emptyRepo = { find: jest.fn().mockResolvedValue([]) } as never
  return {
    service: new PostsService(repo, emptyRepo, emptyRepo, {} as never),
    update,
    qb,
  }
}

/**
 * 曾经两者写同一列，导致拉取失败的作品被算成「拿到了 0」，
 * 前端把默认值当真实数据展示。这两个用例就是钉住这个区分。
 */
describe('指标时间戳', () => {
  it('成功时同时更新 updatedAt 和 checkedAt', async () => {
    const { service, update } = build()
    await service.saveMetrics('p1', { views: 10, likes: 2, comments: 1, shares: 0 })

    const [, patch] = update.mock.calls[0]
    expect(patch).toMatchObject({ views: 10, likes: 2, comments: 1, shares: 0 })
    expect(patch.metricsUpdatedAt).toBeInstanceOf(Date)
    expect(patch.metricsCheckedAt).toBeInstanceOf(Date)
  })

  it('失败时只动 checkedAt，不能碰 updatedAt', async () => {
    const { service, update } = build()
    await service.markAttempted('p1')

    const [, patch] = update.mock.calls[0]
    expect(patch.metricsCheckedAt).toBeInstanceOf(Date)
    expect(patch).not.toHaveProperty('metricsUpdatedAt')
  })
})

/** 作品被删掉后永远拉不回来，不止损就会重试到出了 90 天回收窗口 */
describe('连续失败计数', () => {
  // 读出来加一会在手动触发和定时轮次撞上时丢计数，必须让数据库自增
  it('失败时在库里自增，不是读改写', async () => {
    const { service, update } = build()
    await service.markAttempted('p1')

    const [, patch] = update.mock.calls[0]
    expect(typeof patch.metricsFailCount).toBe('function')
    expect(patch.metricsFailCount()).toBe('metrics_fail_count + 1')
  })

  it('成功一次就归零，不让偶发失败越攒越多', async () => {
    const { service, update } = build()
    await service.saveMetrics('p1', { views: 1, likes: 0, comments: 0, shares: 0 })

    expect(update.mock.calls[0][1].metricsFailCount).toBe(0)
  })

  // 阈值只留在后端，前端认这个布尔值；边界写错会让 UI 提前或永不显示「已停止回收」
  it('把是否放弃算成布尔值给前端，边界是「达到即放弃」', async () => {
    const { service } = build([
      { id: 'a', accountId: 'x', contentId: 'y', metricsFailCount: MAX_METRIC_FAILS - 1 },
      { id: 'b', accountId: 'x', contentId: 'y', metricsFailCount: MAX_METRIC_FAILS },
    ])
    const { data } = await service.findAll('ws1', {})

    expect(data.map((p) => p.metricsAbandoned)).toEqual([false, true])
  })

  it('超限的作品不再进入待刷队列', async () => {
    const { service, qb } = build()
    await service.findStale(new Date(), new Date(), 50)

    const failFilter = qb.andWhere.mock.calls.find(([sql]: [string]) =>
      sql.includes('metrics_fail_count'),
    )
    expect(failFilter).toBeDefined()
    expect(failFilter[0]).toContain('<')
    expect(failFilter[1]).toEqual({ maxFails: MAX_METRIC_FAILS })
  })
})
