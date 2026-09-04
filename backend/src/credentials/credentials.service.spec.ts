import { statusFor } from './credentials.service'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const secondsFromNow = (ms: number) => Math.floor((Date.now() + ms) / 1000)

describe('statusFor', () => {
  // 系统用户令牌就是这一类，判错会让永久凭证天天报失效
  it('0 表示永不过期，算正常', () => {
    expect(statusFor(0)).toBe('active')
  })

  it('bigint 从数据库读出来是字符串，"0" 同样要当永不过期', () => {
    expect(statusFor(Number('0'))).toBe('active')
  })

  it('还有 60 天算正常', () => {
    expect(statusFor(secondsFromNow(60 * DAY))).toBe('active')
  })

  it.each([1, 3, 6])('剩 %s 天进入提醒区间', (days) => {
    expect(statusFor(secondsFromNow(days * DAY))).toBe('expiring')
  })

  it('刚好 7 天还不提醒，差一点就提醒', () => {
    expect(statusFor(secondsFromNow(7 * DAY + HOUR))).toBe('active')
    expect(statusFor(secondsFromNow(7 * DAY - HOUR))).toBe('expiring')
  })

  it('已经过期算失效', () => {
    expect(statusFor(secondsFromNow(-HOUR))).toBe('invalid')
  })
})
