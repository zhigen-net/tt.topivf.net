import { FacebookAdapter } from './facebook.adapter'
import { graphGet } from './graph-api'
import type { Account } from '../../accounts/account.entity'

jest.mock('./graph-api', () => ({
  graphGet: jest.fn(),
  graphPost: jest.fn(),
  graphUpload: jest.fn(),
  GraphError: class extends Error {},
}))

const mockGet = graphGet as jest.Mock

const account = {
  sessionData: { pageId: '932466883290537', pageAccessToken: 'EAA' },
} as unknown as Account

const POST_ID = '932466883290537_122137941489227461'

beforeEach(() => mockGet.mockReset())

/** 贴文字段一次、insights 一次，按调用顺序喂回去 */
function respond(post: unknown, insights: unknown = { data: [] }) {
  mockGet.mockResolvedValueOnce(post).mockResolvedValueOnce(insights)
}

describe('FacebookAdapter.fetchPostMetrics', () => {
  it('未绑定主页直接跳过，不打接口', async () => {
    const metrics = await new FacebookAdapter().fetchPostMetrics(
      { sessionData: undefined } as Account, POST_ID,
    )
    expect(metrics).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('正常返回时四个数都取出来', async () => {
    respond(
      {
        likes: { summary: { total_count: 12 } },
        comments: { summary: { total_count: 3 } },
        shares: { count: 2 },
      },
      { data: [{ values: [{ value: 480 }] }] },
    )

    expect(await new FacebookAdapter().fetchPostMetrics(account, POST_ID)).toEqual({
      views: 480, likes: 12, comments: 3, shares: 2,
    })
  })

  // 主页令牌缺 pages_read_engagement 时 Graph 不报错，只是把字段整个省掉；
  // 当成 0 写回去就是往库里灌假数据
  it('互动字段整个缺席时返回 null 而不是一排 0', async () => {
    respond({ id: POST_ID })
    expect(await new FacebookAdapter().fetchPostMetrics(account, POST_ID)).toBeNull()
  })

  it('真的没人互动仍然写 0，不和读不到混为一谈', async () => {
    respond({
      likes: { summary: { total_count: 0 } },
      comments: { summary: { total_count: 0 } },
      shares: undefined,
    })

    expect(await new FacebookAdapter().fetchPostMetrics(account, POST_ID)).toEqual({
      views: 0, likes: 0, comments: 0, shares: 0,
    })
  })

  // Reel、快拍这些非普通贴文经常在 insights 上直接报错
  it('曝光拿不到不影响其余三个数', async () => {
    mockGet
      .mockResolvedValueOnce({ likes: { summary: { total_count: 7 } } })
      .mockRejectedValueOnce(new Error('unsupported metric'))

    expect(await new FacebookAdapter().fetchPostMetrics(account, POST_ID)).toEqual({
      views: 0, likes: 7, comments: 0, shares: 0,
    })
  })

  it('贴文被删或没权限时返回 null', async () => {
    mockGet.mockRejectedValueOnce(new Error('(#10) Object does not exist'))
    expect(await new FacebookAdapter().fetchPostMetrics(account, POST_ID)).toBeNull()
  })
})
