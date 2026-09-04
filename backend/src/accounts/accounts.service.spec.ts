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
