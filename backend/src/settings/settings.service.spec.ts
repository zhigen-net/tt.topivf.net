import { DEFAULT_SITE_NAME, SettingsService } from './settings.service'
import type { SystemSetting } from './system-setting.entity'

function makeService(existing: Partial<SystemSetting> | null = null) {
  const repo = {
    findOneBy: jest.fn().mockResolvedValue(existing),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => v),
  }
  return { svc: new SettingsService(repo as never), repo }
}

describe('SettingsService', () => {
  it('没配置过时给默认名，但不落库', async () => {
    const { svc, repo } = makeService(null)
    expect((await svc.get()).siteName).toBe(DEFAULT_SITE_NAME)
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('保存时去掉首尾空格', async () => {
    const { svc, repo } = makeService({ id: 1, siteName: '旧名字' })
    await svc.update({ siteName: '  新名字  ' })
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, siteName: '新名字' }))
  })
})
