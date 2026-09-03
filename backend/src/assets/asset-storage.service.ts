import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand,
  PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3'
import type { Readable } from 'stream'

@Injectable()
export class AssetStorageService implements OnModuleInit {
  private readonly logger = new Logger(AssetStorageService.name)
  private readonly client: S3Client
  private readonly bucket: string

  constructor(cfg: ConfigService) {
    this.bucket = cfg.get('MINIO_BUCKET') ?? 'socialhub-media'
    this.client = new S3Client({
      endpoint: `http://${cfg.get('MINIO_ENDPOINT') ?? 'minio'}:${cfg.get('MINIO_PORT') ?? 9000}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId: cfg.get('MINIO_ACCESS_KEY') ?? '',
        secretAccessKey: cfg.get('MINIO_SECRET_KEY') ?? '',
      },
      // MinIO 不做 DNS 形式的 bucket 子域，必须走 path style
      forcePathStyle: true,
    })
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }))
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
      this.logger.log(`已创建素材桶 ${this.bucket}`)
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: key, Body: body, ContentType: contentType,
    }))
  }

  async get(key: string): Promise<Readable> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))
    return res.Body as Readable
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}
