import { buildContainerParams, readSession } from './instagram.adapter'
import type { Content, ContentType } from '../../contents/content.entity'
import type { Account } from '../../accounts/account.entity'

function content(over: Partial<Content> & { type: ContentType }): Content {
  return { hashtags: [], platforms: [], fileUrl: 'https://cdn.test/a.mp4', ...over } as Content
}

describe('buildContainerParams', () => {
  it('图片走 image_url，不带 media_type', () => {
    const p = buildContainerParams(content({ type: 'image', fileUrl: 'https://cdn.test/a.jpg' }))
    expect(p).toEqual({ image_url: 'https://cdn.test/a.jpg', caption: '' })
  })

  it.each<ContentType>(['video', 'reel'])('%s 走 video_url 且按 Reels 投递', (type) => {
    const p = buildContainerParams(content({ type }))
    expect(p.video_url).toBe('https://cdn.test/a.mp4')
    expect(p.media_type).toBe('REELS')
    expect(p.image_url).toBeUndefined()
  })

  it('封面只在有 thumbnailUrl 时带上', () => {
    expect(buildContainerParams(content({ type: 'reel' })).cover_url).toBeUndefined()
    expect(
      buildContainerParams(content({ type: 'reel', thumbnailUrl: 'https://cdn.test/c.jpg' })).cover_url,
    ).toBe('https://cdn.test/c.jpg')
  })

  it('文案拼上话题标签，缺井号会补', () => {
    const p = buildContainerParams(content({ type: 'image', caption: '早安', hashtags: ['a', '#b'] }))
    expect(p.caption).toBe('早安\n\n#a #b')
  })

  // 快拍端点不接受 caption，带上会被拒
  it.each([
    ['https://cdn.test/s.mp4', 'video_url'],
    ['https://cdn.test/s.MOV', 'video_url'],
    ['https://cdn.test/s.jpg', 'image_url'],
    ['https://cdn.test/s.mp4?sig=abc&e=1', 'video_url'],
    ['https://cdn.test/s.png#frag', 'image_url'],
  ])('快拍 %s 按后缀落到 %s，且不带文案', (fileUrl, key) => {
    const p = buildContainerParams(content({ type: 'story', caption: '不该出现', fileUrl }))
    expect(p[key]).toBe(fileUrl)
    expect(p.media_type).toBe('STORIES')
    expect(p.caption).toBeUndefined()
    expect(p.cover_url).toBeUndefined()
  })
})

describe('readSession', () => {
  it('缺任一字段都算没授权', () => {
    expect(readSession({ sessionData: undefined } as Account)).toBeNull()
    expect(readSession({ sessionData: { igUserId: '1' } } as unknown as Account)).toBeNull()
    expect(readSession({ sessionData: { pageAccessToken: 'x' } } as unknown as Account)).toBeNull()
  })

  it('认不出 Facebook 主页的凭证，避免拿错 id 去发布', () => {
    const fb = { sessionData: { pageId: '1', pageAccessToken: 'x' } } as unknown as Account
    expect(readSession(fb)).toBeNull()
  })

  it('字段齐了才返回', () => {
    const ok = { sessionData: { igUserId: '17841', pageAccessToken: 'EAA' } } as unknown as Account
    expect(readSession(ok)).toEqual({ igUserId: '17841', pageAccessToken: 'EAA' })
  })
})
