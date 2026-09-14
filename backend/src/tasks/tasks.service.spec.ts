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

function makePublisher(platforms: string[]) {
  const repo = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ ...x, id: 't-new', scheduledAt: new Date() })),
  }
  const contents = {
    findOneBy: jest.fn().mockResolvedValue({ id: 'c-1', reviewStatus: 'approved', platforms }),
  }
  const accounts = { findBy: jest.fn().mockResolvedValue(ACCOUNTS) }
  const queue = { add: jest.fn() }
  return new TasksService(repo as any, contents as any, accounts as any, queue as any)
}

describe('TasksService 单条发布的平台校验', () => {
  it('账号平台都在作品目标平台内就放行', async () => {
    const svc = makePublisher(['facebook', 'instagram'])
    const task = await svc.create({ contentId: 'c-1', accountIds: ['a-1', 'a-2'] } as any, WS)
    expect(task.id).toBe('t-new')
  })

  it('账号平台不在作品目标平台内就拒绝，并点名是哪个账号', async () => {
    const svc = makePublisher(['facebook'])
    await expect(svc.create({ contentId: 'c-1', accountIds: ['a-1', 'a-2'] } as any, WS))
      .rejects.toThrow('beta')
  })
})
