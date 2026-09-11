import { ConflictException, NotFoundException } from '@nestjs/common'
import { UsersService } from './users.service'
import type { User } from './user.entity'

const BASE = { username: 'bob', password: 'password1', displayName: 'Bob', email: 'bob@example.com' }

function makeService(existing: Partial<User> | null = null) {
  const repo = {
    findOneBy: jest.fn().mockResolvedValue(existing),
    findOne: jest.fn().mockResolvedValue(existing),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => v),
  }
  const workspaces = { findOneBy: jest.fn() }
  const members = { find: jest.fn().mockResolvedValue([]) }

  // 事务里落下的每一行，按实体名分桶，断言用
  const written: { entity: string, value: Record<string, unknown> }[] = []
  const em = {
    create: jest.fn((entity: { name: string }, v: Record<string, unknown>) => ({ ...v, __entity: entity.name })),
    save: jest.fn(async (v: unknown) => {
      const rows = (Array.isArray(v) ? v : [v]) as Record<string, unknown>[]
      for (const row of rows) {
        written.push({ entity: row.__entity as string, value: row })
        row.id ??= `${row.__entity as string}-1`
      }
      return v
    }),
    existsBy: jest.fn().mockResolvedValue(true),
  }
  const ds = { transaction: jest.fn((cb: (m: unknown) => unknown) => cb(em)) }

  const svc = new UsersService(repo as never, workspaces as never, members as never, ds as never)
  const rowsOf = (entity: string) => written.filter((w) => w.entity === entity).map((w) => w.value)
  return { svc, repo, members, em, rowsOf }
}

describe('UsersService 邮箱登录', () => {
  it('查登录账号时邮箱按小写比', async () => {
    const { svc, repo } = makeService(null)
    await svc.findByEmail('  Someone@Example.COM ')
    expect(repo.findOneBy).toHaveBeenCalledWith({ email: 'someone@example.com' })
  })

  it('新建用户时邮箱转小写落库', async () => {
    const { svc, rowsOf } = makeService(null)
    const saved = await svc.create({ ...BASE, email: 'Bob@Example.com' }, 'admin-1')
    expect(saved.email).toBe('bob@example.com')
    expect(rowsOf('User')).toHaveLength(1)
  })

  // 唯一索引在库里，但先在应用层拦一道才能给出中文提示而不是 500
  it('邮箱被别人占了就拒绝', async () => {
    const { svc } = makeService({ id: 'other', email: 'taken@example.com' })
    await expect(svc.create({ ...BASE, email: 'taken@example.com' }, 'admin-1'))
      .rejects.toBeInstanceOf(ConflictException)
  })

  it('改自己资料时能换邮箱', async () => {
    const { svc } = makeService({ id: 'me-1', displayName: '旧名', email: 'old@example.com' })
    const saved = await svc.updateProfile('me-1', { displayName: '新名', email: 'New@Example.com' })
    expect(saved.email).toBe('new@example.com')
    expect(saved.displayName).toBe('新名')
  })

  it('邮箱还是自己的，改资料不算冲突', async () => {
    const { svc } = makeService({ id: 'me-1', displayName: '我', email: 'Mine@Example.com' })
    const saved = await svc.updateProfile('me-1', { displayName: '我', email: 'Mine@Example.com' })
    expect(saved.email).toBe('mine@example.com')
  })
})

describe('UsersService 建号时的空间归属', () => {
  it('不传 workspaceMode 就不写任何成员关系', async () => {
    const { svc, rowsOf } = makeService(null)
    await svc.create(BASE, 'admin-1')
    expect(rowsOf('WorkspaceMember')).toHaveLength(0)
    expect(rowsOf('Workspace')).toHaveLength(0)
  })

  it('none 同样不写成员关系', async () => {
    const { svc, rowsOf } = makeService(null)
    await svc.create({ ...BASE, workspaceMode: 'none' }, 'admin-1')
    expect(rowsOf('WorkspaceMember')).toHaveLength(0)
  })

  it('join 进现有空间，角色默认 member', async () => {
    const { svc, rowsOf } = makeService(null)
    await svc.create({ ...BASE, workspaceMode: 'join', workspaceId: 'ws-9' }, 'admin-1')
    expect(rowsOf('Workspace')).toHaveLength(0)
    expect(rowsOf('WorkspaceMember')).toEqual([
      expect.objectContaining({ workspaceId: 'ws-9', userId: 'User-1', role: 'member' }),
    ])
  })

  it('join 时能指定角色', async () => {
    const { svc, rowsOf } = makeService(null)
    await svc.create(
      { ...BASE, workspaceMode: 'join', workspaceId: 'ws-9', workspaceRole: 'viewer' },
      'admin-1',
    )
    expect(rowsOf('WorkspaceMember')[0]).toMatchObject({ role: 'viewer' })
  })

  it('join 到不存在的空间就整笔失败', async () => {
    const { svc, em } = makeService(null)
    em.existsBy.mockResolvedValue(false)
    await expect(svc.create({ ...BASE, workspaceMode: 'join', workspaceId: 'ws-nope' }, 'admin-1'))
      .rejects.toBeInstanceOf(NotFoundException)
  })

  it('新建空间时拥有者是新用户，不是操作的管理员', async () => {
    const { svc, rowsOf } = makeService(null)
    await svc.create({ ...BASE, workspaceMode: 'create', workspaceName: 'Bob 的空间' }, 'admin-1')
    expect(rowsOf('Workspace')).toEqual([
      expect.objectContaining({ name: 'Bob 的空间', createdById: 'User-1' }),
    ])
  })

  // 只给新人 manager 的话，assertNotSoleManager 会让这个号从建出来那刻起就删不掉
  it('新建空间时新用户和操作的管理员都是 manager', async () => {
    const { svc, rowsOf } = makeService(null)
    await svc.create({ ...BASE, workspaceMode: 'create', workspaceName: 'Bob 的空间' }, 'admin-1')
    expect(rowsOf('WorkspaceMember')).toEqual([
      expect.objectContaining({ workspaceId: 'Workspace-1', userId: 'User-1', role: 'manager' }),
      expect.objectContaining({ workspaceId: 'Workspace-1', userId: 'admin-1', role: 'manager' }),
    ])
  })
})

describe('UsersService.findAll 带空间列表', () => {
  it('按用户分组挂上空间', async () => {
    const { svc, repo, members } = makeService(null)
    repo.find.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }])
    members.find.mockResolvedValue([
      { userId: 'u1', workspaceId: 'w1', role: 'manager', workspace: { name: 'A' } },
      { userId: 'u1', workspaceId: 'w2', role: 'viewer', workspace: { name: 'B' } },
    ])
    const [a, b] = await svc.findAll()
    expect(a.workspaces).toEqual([
      { id: 'w1', name: 'A', role: 'manager' },
      { id: 'w2', name: 'B', role: 'viewer' },
    ])
    expect(b.workspaces).toEqual([])
  })

  // 展开成字面量会丢掉类原型，ClassSerializerInterceptor 的 @Exclude 随之失效，
  // 密码哈希就会跟着响应出去。所以这里必须是「同一个对象被改写」
  it('挂空间时改写原实例而不是复制', async () => {
    const { svc, repo, members } = makeService(null)
    const row = { id: 'u1' }
    repo.find.mockResolvedValue([row])
    members.find.mockResolvedValue([])
    const [out] = await svc.findAll()
    expect(out).toBe(row)
  })

  it('没有用户时不去查成员表', async () => {
    const { svc, members } = makeService(null)
    expect(await svc.findAll()).toEqual([])
    expect(members.find).not.toHaveBeenCalled()
  })
})
