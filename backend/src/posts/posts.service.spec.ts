import { PostsService } from './posts.service'
import type { Repository } from 'typeorm'
import type { Post } from './post.entity'

function build() {
  const update = jest.fn().mockResolvedValue(undefined)
  const repo = { update } as unknown as Repository<Post>
  return { service: new PostsService(repo, {} as never, {} as never, {} as never), update }
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
