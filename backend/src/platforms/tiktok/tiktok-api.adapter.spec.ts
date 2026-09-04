import { pickPrivacy, buildCaption } from './tiktok-api.adapter'
import { readSession } from './tiktok-token.service'
import type { Content } from '../../contents/content.entity'
import type { Account } from '../../accounts/account.entity'

describe('pickPrivacy', () => {
  it('挑平台给出的最公开选项', () => {
    expect(pickPrivacy(['SELF_ONLY', 'PUBLIC_TO_EVERYONE'])).toBe('PUBLIC_TO_EVERYONE')
    expect(pickPrivacy(['SELF_ONLY', 'FOLLOWER_OF_CREATOR'])).toBe('FOLLOWER_OF_CREATOR')
  })

  // 未过审的应用只会拿到 SELF_ONLY，硬写 PUBLIC 会被直接拒
  it('拿不到可选项时退回 SELF_ONLY', () => {
    expect(pickPrivacy(undefined)).toBe('SELF_ONLY')
    expect(pickPrivacy([])).toBe('SELF_ONLY')
    expect(pickPrivacy(['SOMETHING_NEW'])).toBe('SELF_ONLY')
  })
})

describe('buildCaption', () => {
  function content(over: Partial<Content>): Content {
    return { hashtags: [], ...over } as Content
  }

  it('话题缺井号会补上', () => {
    expect(buildCaption(content({ caption: '早安', hashtags: ['a', '#b'] }))).toBe('早安 #a #b')
  })

  it('只有话题或只有文案都不留多余空格', () => {
    expect(buildCaption(content({ hashtags: ['a'] }))).toBe('#a')
    expect(buildCaption(content({ caption: '早安' }))).toBe('早安')
  })

  it('超过 2200 字符会被截断，否则整个请求会被拒', () => {
    expect(buildCaption(content({ caption: 'x'.repeat(3000) }))).toHaveLength(2200)
  })
})

describe('readSession', () => {
  it('没有 refresh token 就当没授权，走浏览器那条老路', () => {
    expect(readSession({ sessionData: undefined } as Account)).toBeNull()
    expect(readSession({ sessionData: { cookies: '[]' } } as unknown as Account)).toBeNull()
    expect(readSession({ sessionData: { tiktok: { openId: 'x' } } } as unknown as Account)).toBeNull()
  })

  it('存了密文 refresh token 才算完成官方授权', () => {
    const account = {
      sessionData: { tiktok: { openId: 'x', encryptedRefreshToken: 'v1:abc' } },
    } as unknown as Account
    expect(readSession(account)?.openId).toBe('x')
  })
})
