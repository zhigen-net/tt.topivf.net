import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AccountsService } from './accounts.service'
import type { Account, AccountStatus } from './account.entity'

const WS = 'ws-1'

function makeService(account: Partial<Account> | null) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(account),
    remove: jest.fn().mockResolvedValue(undefined),
  }
  const browserManager = { closeContext: jest.fn().mockResolvedValue(undefined) }
  const svc = new AccountsService(repo as any, {} as any, browserManager as any)
  return { svc, repo, browserManager }
}

describe('AccountsService.remove', () => {
  it('停用状态才允许删除', async () => {
    const { svc, repo, browserManager } = makeService({ id: 'a-1', status: 'inactive' })
    await svc.remove('a-1', WS)
    expect(repo.remove).toHaveBeenCalled()
    expect(browserManager.closeContext).toHaveBeenCalledWith('a-1')
  })

  // 前端会把删除按钮藏起来，但接口是公开的，闸门必须在服务端
  it.each<AccountStatus>(['active', 'warming', 'banned'])('%s 状态拒绝删除', async (status) => {
    const { svc, repo } = makeService({ id: 'a-1', status })
    await expect(svc.remove('a-1', WS)).rejects.toBeInstanceOf(BadRequestException)
    expect(repo.remove).not.toHaveBeenCalled()
  })

  it('账号不在本空间时先报找不到，不泄露状态', async () => {
    const { svc } = makeService(null)
    await expect(svc.remove('a-1', WS)).rejects.toBeInstanceOf(NotFoundException)
  })
})

function searchService(rowCount = 0) {
  const find = jest.fn().mockResolvedValue([])
  const count = jest.fn().mockResolvedValue(rowCount)
  const svc = new AccountsService({ find, count } as any, {} as any, {} as any)
  return { svc, find, count }
}

describe('AccountsService.findAll 搜索', () => {
  it('用户名和昵称都能搜到——列表上昵称更显眼，只搜用户名会让人以为账号不存在', async () => {
    const { svc, find } = searchService()
    await svc.findAll(WS, { search: '张三' })

    const { where } = find.mock.calls[0][0]
    expect(Array.isArray(where)).toBe(true)
    expect(where.map((w: any) => Object.keys(w).find((k) => k !== 'workspaceId')))
      .toEqual(['username', 'displayName'])
  })

  // 数组即 OR。漏写一个分支的 workspaceId，别人空间的账号就会被搜出来
  it('OR 的每个分支都带 workspaceId，不能跨空间泄漏', async () => {
    const { svc, find, count } = searchService()
    await svc.findAll(WS, { search: 'x', platform: 'tiktok' })

    for (const branch of find.mock.calls[0][0].where) {
      expect(branch.workspaceId).toBe(WS)
      expect(branch.platform).toBe('tiktok')
    }
    // 计数漏掉筛选条件的话，总数会大于实际能翻到的条数
    expect(count.mock.calls[0][0].where).toEqual(find.mock.calls[0][0].where)
  })

  it('没有搜索词时不走 OR，保持单条件查询', async () => {
    const { svc, find } = searchService()
    await svc.findAll(WS, {})

    expect(find.mock.calls[0][0].where).toEqual({ workspaceId: WS })
  })
})

/**
 * 总数曾经取自 findAndCount。它会跟着那个只投影 credential 字段的 select 走，
 * 把 COUNT(DISTINCT …) 建到凭证列上——生产上 28 个账号报成 total: 2，
 * 于是 totalPages 算成 1，翻页控件根本不出现。
 */
describe('AccountsService.findAll 总数', () => {
  it('总数来自独立的 count，不跟着带 join 的查询走', async () => {
    const { svc, find, count } = searchService(28)
    const res = await svc.findAll(WS, { limit: 20 })

    expect(count).toHaveBeenCalled()
    expect(res.total).toBe(28)
    expect(res.totalPages).toBe(2)
    // 分页只能加在取数据那一支上，加到计数上就永远只数一页
    expect(count.mock.calls[0][0]).not.toHaveProperty('take')
    expect(find.mock.calls[0][0].take).toBe(20)
  })
})
