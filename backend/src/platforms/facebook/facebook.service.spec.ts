import { ConfigService } from '@nestjs/config'
import { FacebookService } from './facebook.service'
import { graphGet } from './graph-api'
import { inspectToken } from './token'

jest.mock('./graph-api', () => ({
  graphGet: jest.fn(),
  GraphError: class extends Error {
    isAuthError = false
    isRateLimit = false
  },
}))
jest.mock('./token', () => ({
  inspectToken: jest.fn(),
  exchangeForLongLived: jest.fn(),
}))

const mockGet = graphGet as jest.Mock
const mockInspect = inspectToken as jest.Mock

const APP_ID = 'app-1'
const config = { get: (k: string) => ({ FACEBOOK_APP_ID: APP_ID, FACEBOOK_APP_SECRET: 's' })[k] }
const service = () => new FacebookService(config as unknown as ConfigService)

const page = {
  id: 'p1',
  name: '示例主页',
  access_token: 'PAGE-SECRET',
  followers_count: 42,
  tasks: ['CREATE_CONTENT'],
}

beforeEach(() => {
  mockGet.mockReset()
  mockInspect.mockReset()
})

describe('FacebookService.inspect', () => {
  it('令牌齐全时不报任何问题，并列出主页', async () => {
    mockInspect.mockResolvedValue({
      type: 'SYSTEM_USER', appId: APP_ID, scopes: ['pages_show_list', 'pages_manage_posts'], expiresAt: 0,
    })
    mockGet.mockResolvedValue({ data: [page] })

    const report = await service().inspect('EAA')
    expect(report.problems).toEqual([])
    expect(report.pageCount).toBe(1)
    expect(report.missingScopes).toEqual([])
  })

  // pages 里带着主页令牌，整条回给前端等于把凭证发出去
  it('回给前端的主页只留展示字段，不带主页令牌', async () => {
    mockInspect.mockResolvedValue({
      type: 'SYSTEM_USER', appId: APP_ID, scopes: ['pages_show_list', 'pages_manage_posts'], expiresAt: 0,
    })
    mockGet.mockResolvedValue({ data: [page] })

    const report = await service().inspect('EAA')
    expect(report.pages).toEqual([{ name: '示例主页', followers: 42, instagram: null }])
    expect(JSON.stringify(report)).not.toContain('PAGE-SECRET')
  })

  it('缺权限和读不到主页要一次报全，而不是抛在第一个问题上', async () => {
    mockInspect.mockResolvedValue({
      type: 'SYSTEM_USER', appId: APP_ID, scopes: ['pages_show_list'], expiresAt: 0,
    })
    mockGet.mockResolvedValue({ data: [] })

    const report = await service().inspect('EAA')
    expect(report.problems.map((p) => p.code)).toEqual(['MISSING_SCOPES', 'NO_PAGES'])
  })

  it('主页令牌不再去打 /me/accounts，免得把同一个问题报两遍', async () => {
    mockInspect.mockResolvedValue({ type: 'PAGE', appId: APP_ID, scopes: [], expiresAt: 0 })

    const report = await service().inspect('EAA')
    expect(report.problems.map((p) => p.code)).toEqual(['PAGE_TOKEN'])
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('别的应用签发的短期用户令牌，要提前说明本系统换不了', async () => {
    mockInspect.mockResolvedValue({
      type: 'USER',
      appId: 'other-app',
      scopes: ['pages_show_list', 'pages_manage_posts'],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    })
    mockGet.mockResolvedValue({ data: [page] })

    const report = await service().inspect('EAA')
    expect(report.problems.map((p) => p.code)).toEqual(['SHORT_LIVED'])
    expect(report.exchangeBlocker).toContain('other-app')
  })
})
