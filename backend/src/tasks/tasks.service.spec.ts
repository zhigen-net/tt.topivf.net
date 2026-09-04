import { TasksService } from './tasks.service'
import type { PublishTask } from './publish-task.entity'

const WS = 'ws-1'

const ACCOUNTS = [
  { id: 'a-1', username: 'alpha', displayName: '账号一', platform: 'facebook', avatar: 'https://cdn/a1.png' },
  { id: 'a-2', username: 'beta', displayName: '账号二', platform: 'instagram', avatar: undefined },
]

function makeService(tasks: Partial<PublishTask>[]) {
  const qb: Record<string, jest.Mock> = {}
  for (const m of ['leftJoinAndSelect', 'where', 'orderBy', 'skip', 'take', 'andWhere']) {
    qb[m] = jest.fn(() => qb)
  }
  qb.getManyAndCount = jest.fn().mockResolvedValue([tasks, tasks.length])

  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    findOneBy: jest.fn().mockResolvedValue(tasks[0] ?? null),
  }
  const accounts = { find: jest.fn().mockResolvedValue(ACCOUNTS) }
  const svc = new TasksService(repo as any, {} as any, accounts as any, {} as any)
  return { svc, accounts }
}

describe('TasksService 账号补全', () => {
  it('列表把 accountIds 换成可展示的账号信息', async () => {
    const { svc } = makeService([{ id: 't-1', accountIds: ['a-1', 'a-2'] }])
    const res = await svc.findAll(WS, 1, 20)
    expect(res.data[0].accounts).toEqual(ACCOUNTS)
  })

  // 账号删了历史任务还在，这时候整条记录不能凭空少一行
  it('查不到的账号直接略过，不塞占位对象', async () => {
    const { svc } = makeService([{ id: 't-1', accountIds: ['a-1', 'gone'] }])
    const res = await svc.findAll(WS, 1, 20)
    expect(res.data[0].accounts.map((a) => a.id)).toEqual(['a-1'])
    expect(res.data[0].accountIds).toEqual(['a-1', 'gone'])
  })

  it('多个任务共用的账号只查一次', async () => {
    const { svc, accounts } = makeService([
      { id: 't-1', accountIds: ['a-1', 'a-2'] },
      { id: 't-2', accountIds: ['a-1'] },
    ])
    await svc.findAll(WS, 1, 20)
    expect(accounts.find).toHaveBeenCalledTimes(1)
    expect(accounts.find.mock.calls[0][0].where.id._value).toEqual(['a-1', 'a-2'])
  })

  it('没有账号的任务不查库', async () => {
    const { svc, accounts } = makeService([{ id: 't-1', accountIds: [] }])
    const res = await svc.findAll(WS, 1, 20)
    expect(accounts.find).not.toHaveBeenCalled()
    expect(res.data[0].accounts).toEqual([])
  })

  it('详情接口同样带上账号信息', async () => {
    const { svc } = makeService([{ id: 't-1', accountIds: ['a-2'] }])
    const task = await svc.findOne('t-1', WS)
    expect(task.accounts.map((a) => a.displayName)).toEqual(['账号二'])
  })
})
