import { coverUrlOf } from './contents.service'
import type { Content } from './content.entity'

const THUMBS = new Map([['thumb-asset', 'https://signed/thumb.jpg']])
const COVERS = new Map([['main-asset', 'https://signed/main.jpg']])

const content = (over: Partial<Content>) =>
  ({ type: 'video', ...over }) as Parameters<typeof coverUrlOf>[0]

describe('coverUrlOf', () => {
  it('用户设的外链封面优先级最高', () => {
    const c = content({ thumbnailUrl: 'https://cdn/x.jpg', thumbnailAssetId: 'thumb-asset', assetId: 'main-asset' })
    expect(coverUrlOf(c, THUMBS, COVERS)).toBe('https://cdn/x.jpg')
  })

  it('其次是素材库封面', () => {
    const c = content({ thumbnailAssetId: 'thumb-asset', assetId: 'main-asset' })
    expect(coverUrlOf(c, THUMBS, COVERS)).toBe('https://signed/thumb.jpg')
  })

  it('没设封面就退到配图', () => {
    expect(coverUrlOf(content({ assetId: 'main-asset' }), THUMBS, COVERS)).toBe('https://signed/main.jpg')
  })

  // 视频素材不在 covers 里，回落时要落空而不是给出一个裂图地址
  it('配图是视频素材时不当封面', () => {
    expect(coverUrlOf(content({ assetId: 'video-asset' }), THUMBS, COVERS)).toBeUndefined()
  })

  it('图片类作品的外链配图可以当封面', () => {
    expect(coverUrlOf(content({ type: 'image', fileUrl: 'https://cdn/p.png' }), THUMBS, COVERS))
      .toBe('https://cdn/p.png')
  })

  it.each(['video', 'reel', 'story'] as const)('%s 的外链不能当封面', (type) => {
    expect(coverUrlOf(content({ type, fileUrl: 'https://cdn/v.mp4' }), THUMBS, COVERS)).toBeUndefined()
  })

  it('什么都没有就返回 undefined', () => {
    expect(coverUrlOf(content({}), THUMBS, COVERS)).toBeUndefined()
  })
})
