import { AnalyticsService } from './analytics.service'
import type { Repository } from 'typeorm'
import type { StatsSnapshot } from './stats-snapshot.entity'
import type { Account } from '../accounts/account.entity'

const HOUR = 60 * 60 * 1000
const GAP = 20 * HOUR

const account = {
  id: 'a1', platform: 'tiktok', followers: 1200, following: 30,
} as Account

function build(latestAgeMs: number | null) {
  const saved: Partial<StatsSnapshot>[] = []
  const repo = {
    findOne: jest.fn().mockResolvedValue(
      latestAgeMs === null ? null : { recordedAt: new Date(Date.now() - latestAgeMs) },
    ),
    create: (d: Partial<StatsSnapshot>) => d,
    save: jest.fn(async (d: Partial<StatsSnapshot>) => {
      saved.push(d)
      return d
    }),
  } as unknown as Repository<StatsSnapshot>

  return { service: new AnalyticsService(repo, {} as never), saved }
}

describe('snapshotIfDue', () => {
  it('从没拉过快照就直接写一张', async () => {
    const { service, saved } = build(null)
    expect(await service.snapshotIfDue(account, GAP)).toBe(true)
    expect(saved).toEqual([
      { accountId: 'a1', platform: 'tiktok', followers: 1200, following: 30 },
    ])
  })

  // sh_api 重启很频繁，只靠调度器计时器会在一天内堆出十几张
  it('距上一张不够间隔就不写，判重看库不看计时器', async () => {
    const { service, saved } = build(2 * HOUR)
    expect(await service.snapshotIfDue(account, GAP)).toBe(false)
    expect(saved).toHaveLength(0)
  })

  it('超过间隔才写下一张', async () => {
    const { service, saved } = build(GAP + HOUR)
    expect(await service.snapshotIfDue(account, GAP)).toBe(true)
    expect(saved).toHaveLength(1)
  })
})
