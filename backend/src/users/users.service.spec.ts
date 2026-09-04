import { ConflictException } from '@nestjs/common'
import { UsersService } from './users.service'
import type { User } from './user.entity'

function makeService(existing: Partial<User> | null = null) {
  const qb: Record<string, jest.Mock> = {}
  qb.where = jest.fn(() => qb)
  qb.getOne = jest.fn().mockResolvedValue(existing)

  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    findOneBy: jest.fn().mockResolvedValue(existing),
    findOne: jest.fn().mockResolvedValue(existing),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => v),
  }
  const svc = new UsersService(repo as any, {} as any)
  return { svc, repo, qb }
}

describe('UsersService 邮箱登录', () => {
  it('用户名和邮箱查的是同一条语句，邮箱那侧按小写比', async () => {
    const { svc, qb } = makeService(null)
    await svc.findByLogin('  Someone@Example.COM ')
    expect(qb.where).toHaveBeenCalledWith(
      'u.username = :value OR u.email = :email',
      { value: 'Someone@Example.COM', email: 'someone@example.com' },
    )
  })

  it('新建用户时邮箱转小写落库', async () => {
    const { svc, repo } = makeService(null)
    const saved = await svc.create({
      username: 'bob', password: 'password1', displayName: 'Bob', email: 'Bob@Example.com',
    })
    expect(saved.email).toBe('bob@example.com')
    expect(repo.save).toHaveBeenCalled()
  })

  // 唯一索引在库里，但先在应用层拦一道才能给出中文提示而不是 500
  it('邮箱被别人占了就拒绝', async () => {
    const { svc } = makeService({ id: 'other', email: 'taken@example.com' })
    await expect(svc.create({
      username: 'bob', password: 'password1', displayName: 'Bob', email: 'taken@example.com',
    })).rejects.toBeInstanceOf(ConflictException)
  })

  it('留空邮箱存成 null，不是空串', async () => {
    const { svc } = makeService(null)
    const saved = await svc.create({ username: 'bob', password: 'password1', displayName: 'Bob' })
    expect(saved.email).toBeNull()
  })

  it('改自己资料时把邮箱清空', async () => {
    const { svc } = makeService({ id: 'me-1', displayName: '旧名', email: 'old@example.com' })
    const saved = await svc.updateProfile('me-1', { displayName: '新名', email: null })
    expect(saved.email).toBeNull()
    expect(saved.displayName).toBe('新名')
  })

  it('邮箱还是自己的，改资料不算冲突', async () => {
    const { svc } = makeService({ id: 'me-1', displayName: '我', email: 'mine@example.com' })
    const saved = await svc.updateProfile('me-1', { displayName: '我', email: 'Mine@Example.com' })
    expect(saved.email).toBe('mine@example.com')
  })
})
