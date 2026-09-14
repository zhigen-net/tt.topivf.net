import { NestFactory } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { AppModule } from '../app.module'
import { Asset } from './asset.entity'
import { AssetStorageService } from './asset-storage.service'
import { AssetsService } from './assets.service'

/**
 * 给缩略图功能上线前就存在的图片补生成。
 * 在 api 容器里跑：node dist/assets/backfill-thumbs.js
 * 可以重复执行，已经有 thumb_key 的会跳过。
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] })
  const repo = app.get<Repository<Asset>>(getRepositoryToken(Asset))
  const storage = app.get(AssetStorageService)
  const assets = app.get(AssetsService)

  const pending = await repo.findBy({ type: 'image', thumbKey: IsNull() })
  console.log(`待回填 ${pending.length} 张图片`)

  let done = 0
  let failed = 0
  for (const asset of pending) {
    try {
      const buffer = await readAll(await storage.get(asset.objectKey))
      const thumbKey = await assets.putThumbnail(asset.objectKey, buffer)
      if (!thumbKey) {
        failed++
        console.log(`  跳过 ${asset.filename}：生成不出缩略图`)
        continue
      }
      await repo.update(asset.id, { thumbKey })
      done++
      console.log(`  ok ${asset.filename}`)
    } catch (err) {
      failed++
      console.log(`  失败 ${asset.filename}：${(err as Error).message}`)
    }
  }

  console.log(`回填完成：成功 ${done}，失败 ${failed}`)
  await app.close()
}

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
