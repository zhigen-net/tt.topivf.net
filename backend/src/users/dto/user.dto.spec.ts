import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateUserDto, ChangePasswordDto } from './user.dto'

const HANZI = '密' // UTF-8 占 3 字节

async function errorsFor<T extends object>(cls: new () => T, payload: Record<string, unknown>) {
  const dto = plainToInstance(cls, payload)
  const errors = await validate(dto)
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}))
}

const base = {
  username: 'someone',
  displayName: '张三',
  email: 'a@b.com',
}

/**
 * bcrypt 只哈希前 72 字节。用按字符计的 MaxLength(72) 把关，30 个汉字（90 字节）
 * 能过校验，而 bcrypt 会把第 72 字节之后的内容悄悄丢掉——两个不同的密码于是等价。
 */
describe('密码长度按字节校验', () => {
  it('72 字节的中文密码放行（24 个汉字，正好到上限）', async () => {
    const errors = await errorsFor(CreateUserDto, { ...base, password: HANZI.repeat(24) })
    expect(errors).toEqual([])
  })

  it('90 字节的中文密码被拒——字符数才 30，MaxLength(72) 是拦不住的', async () => {
    const errors = await errorsFor(CreateUserDto, { ...base, password: HANZI.repeat(30) })
    expect(errors).toContain('maxBytes')
  })

  it('72 个 ASCII 字符仍然放行', async () => {
    const errors = await errorsFor(CreateUserDto, { ...base, password: 'a'.repeat(72) })
    expect(errors).toEqual([])
  })

  it('最短 8 位仍按字符算，别把中文短密码误伤了', async () => {
    const ok = await errorsFor(CreateUserDto, { ...base, password: HANZI.repeat(8) })
    expect(ok).toEqual([])

    const tooShort = await errorsFor(CreateUserDto, { ...base, password: HANZI.repeat(7) })
    expect(tooShort).toContain('minLength')
  })

  // 老用户的密码可能超 72 字节，当初被 bcrypt 截断后存下、至今能登录。
  // 这里若跟着收紧，他们连旧密码都填不进来，等于锁死且无法自救。
  it('验证旧密码时不收紧，否则超长密码的老用户改不了密码', async () => {
    const errors = await errorsFor(ChangePasswordDto, {
      password: 'newpassword',
      currentPassword: HANZI.repeat(30),
    })
    expect(errors).not.toContain('maxBytes')
  })
})
