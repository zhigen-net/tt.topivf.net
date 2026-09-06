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

function searchService() {
  const findAndCount = jest.fn().mockResolvedValue([[], 0])
  const svc = new AccountsService({ findAndCount } as any, {} as any, {} as any)
  return { svc, findAndCount }
}

describe('AccountsService.findAll 搜索', () => {
  it('用户名和昵称都能搜到——列表上昵称更显眼，只搜用户名会让人以为账号不存在', async () => {
    const { svc, findAndCount } = searchService()
    await svc.findAll(WS, { search: '张三' })

    const { where } = findAndCount.mock.calls[0][0]
    expect(Array.isArray(where)).toBe(true)
    expect(where.map((w: any) => Object.keys(w).find((k) => k !== 'workspaceId')))
      .toEqual(['username', 'displayName'])
  })

  // 数组即 OR。漏写一个分支的 workspaceId，别人空间的账号就会被搜出来
  it('OR 的每个分支都带 workspaceId，不能跨空间泄漏', async () => {
    const { svc, findAndCount } = searchService()
    await svc.findAll(WS, { search: 'x', platform: 'tiktok' })

    const { where } = findAndCount.mock.calls[0][0]
    for (const branch of where) {
      expect(branch.workspaceId).toBe(WS)
      expect(branch.platform).toBe('tiktok')
    }
  })

  it('没有搜索词时不走 OR，保持单条件查询', async () => {
    const { svc, findAndCount } = searchService()
    await svc.findAll(WS, {})

    expect(findAndCount.mock.calls[0][0].where).toEqual({ workspaceId: WS })
  })
})
