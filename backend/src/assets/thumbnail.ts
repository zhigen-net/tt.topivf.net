import { Logger } from '@nestjs/common'
import sharp from 'sharp'

export const THUMB_MIME = 'image/webp'

/** 够撑满素材库网格里最大的一格，再大就只是浪费带宽 */
const THUMB_WIDTH = 480

const logger = new Logger('Thumbnail')

/**
 * 生成列表和选择器用的小图。生成不了就返回 null——
 * 缩略图只是加载快慢的问题，不该让一次上传整个失败。
 */
export async function makeThumbnail(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer, { failOn: 'none' })
      // 手机拍的图方向记在 EXIF 里，不转正缩略图会躺着
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer()
  } catch (err) {
    logger.warn(`缩略图生成失败，回退到原图：${(err as Error).message}`)
    return null
  }
}

/** 缩略图和原对象放同一个前缀下，删素材时顺手就能删掉 */
export function thumbKeyFor(objectKey: string) {
  return `${objectKey}.thumb.webp`
}
