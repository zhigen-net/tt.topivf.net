import { planChunks, chunkRange } from './tiktok-upload'
import { TiktokApiError } from './tiktok-api'

const MB = 1024 * 1024

/** 把整个文件按计划切一遍，验证区间既不重叠也不漏字节 */
function cover(size: number) {
  const plan = planChunks(size)
  const ranges = Array.from({ length: plan.totalChunks }, (_, i) => chunkRange(i, plan, size))
  return { plan, ranges }
}

describe('planChunks', () => {
  it('空文件直接报错，不要等 TikTok 拒绝', () => {
    expect(() => planChunks(0)).toThrow(TiktokApiError)
  })

  it('小于 5MB 不许分片，整个当一片', () => {
    expect(planChunks(3 * MB)).toEqual({ chunkSize: 3 * MB, totalChunks: 1 })
  })

  it('5MB 到 64MB 之间还是一片', () => {
    expect(planChunks(30 * MB)).toEqual({ chunkSize: 30 * MB, totalChunks: 1 })
    expect(planChunks(64 * MB)).toEqual({ chunkSize: 64 * MB, totalChunks: 1 })
  })

  it('超过 64MB 按 64MB 切，片数向下取整', () => {
    // 200MB / 64MB = 3.125 → 3 片，余下的 8MB 并进最后一片
    expect(planChunks(200 * MB)).toEqual({ chunkSize: 64 * MB, totalChunks: 3 })
  })
})

describe('chunkRange', () => {
  it.each([1 * MB, 5 * MB, 64 * MB, 100 * MB, 200 * MB, 513 * MB])(
    '%i 字节切完后首尾相接且正好覆盖整个文件',
    (size) => {
      const { ranges } = cover(size)
      expect(ranges[0][0]).toBe(0)
      expect(ranges[ranges.length - 1][1]).toBe(size - 1)
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i][0]).toBe(ranges[i - 1][1] + 1)
      }
    },
  )

  it('最后一片吃掉余数，会比 chunk_size 大', () => {
    const size = 200 * MB
    const { plan, ranges } = cover(size)
    const last = ranges[2]
    expect(last[1] - last[0] + 1).toBe(72 * MB)
    expect(plan.chunkSize).toBe(64 * MB)
  })
})
