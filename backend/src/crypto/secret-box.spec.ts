import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import { SecretBox } from './secret-box'

function boxWith(key?: string): SecretBox {
  return new SecretBox({ get: () => key } as unknown as ConfigService)
}

const HEX_KEY = randomBytes(32).toString('hex')

describe('SecretBox', () => {
  it('密文能还原成原文', () => {
    const box = boxWith(HEX_KEY)
    expect(box.decrypt(box.encrypt('EAA-token'))).toBe('EAA-token')
  })

  it('hex 和 base64 两种密钥格式都收', () => {
    const raw = randomBytes(32)
    for (const key of [raw.toString('hex'), raw.toString('base64')]) {
      expect(boxWith(key).enabled).toBe(true)
    }
  })

  // 每次随机 IV，否则相同令牌会产生相同密文，能被看出哪些账号共用一条凭证
  it('同样的明文每次加密结果都不同', () => {
    const box = boxWith(HEX_KEY)
    expect(box.encrypt('same')).not.toBe(box.encrypt('same'))
  })

  it('换了密钥解不开，而不是返回乱码', () => {
    const cipher = boxWith(HEX_KEY).encrypt('EAA-token')
    expect(() => boxWith(randomBytes(32).toString('hex')).decrypt(cipher)).toThrow(/重新绑定/)
  })

  it('密文被篡改会被认证标签挡下', () => {
    const box = boxWith(HEX_KEY)
    const [v, iv, tag, ct] = box.encrypt('EAA-token').split(':')
    const flipped = Buffer.from(ct, 'base64')
    flipped[0] ^= 0xff
    expect(() => box.decrypt([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow()
  })

  it.each([
    ['', '没配'],
    ['   ', '空白'],
    ['too-short', '长度不足'],
    [randomBytes(16).toString('hex'), '16 字节'],
  ])('%s（%s）一律当没配，不用弱密钥凑合', (key) => {
    expect(boxWith(key).enabled).toBe(false)
  })

  it('没配密钥时加解密都明确报错', () => {
    const box = boxWith(undefined)
    expect(() => box.encrypt('x')).toThrow(/CREDENTIAL_ENCRYPTION_KEY/)
    expect(() => box.decrypt('v1:a:b:c')).toThrow(/CREDENTIAL_ENCRYPTION_KEY/)
  })

  it.each(['', 'plain-text', 'v2:a:b:c', 'v1:only:three'])('认不出的密文格式直接拒绝：%s', (bad) => {
    expect(() => boxWith(HEX_KEY).decrypt(bad)).toThrow(/无法识别/)
  })
})
