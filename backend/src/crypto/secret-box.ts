import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
const PREFIX = 'v1'

/**
 * 令牌之类的密码等价物落库前先过这里。密文自带 v1 前缀，以后换算法时
 * 可以按前缀分流，老数据不用一次性重写。
 */
@Injectable()
export class SecretBox {
  private readonly logger = new Logger(SecretBox.name)
  private readonly key: Buffer | null

  constructor(cfg: ConfigService) {
    this.key = parseKey(cfg.get<string>('CREDENTIAL_ENCRYPTION_KEY'))
    if (!this.key) {
      // 没配密钥不该拖垮整个服务，只是凭证托管用不了；真正加解密时才报错
      this.logger.warn('CREDENTIAL_ENCRYPTION_KEY 未配置或格式不对，凭证托管功能不可用')
    }
  }

  get enabled(): boolean {
    return this.key !== null
  }

  encrypt(plain: string): string {
    const key = this.requireKey()
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    return [PREFIX, iv, cipher.getAuthTag(), ct].map(toPart).join(':')
  }

  decrypt(payload: string): string {
    const key = this.requireKey()
    const [prefix, iv, tag, ct] = payload.split(':')
    if (prefix !== PREFIX || !iv || !tag || !ct) {
      throw new InternalServerErrorException('密文格式无法识别')
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'))
      decipher.setAuthTag(Buffer.from(tag, 'base64'))
      return Buffer.concat([
        decipher.update(Buffer.from(ct, 'base64')),
        decipher.final(),
      ]).toString('utf8')
    } catch {
      // 认证失败要么是密钥换了，要么密文被改过，两种都只能重新绑定
      throw new InternalServerErrorException('凭证解密失败，可能是加密密钥已更换，请重新绑定')
    }
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new InternalServerErrorException(
        '未配置 CREDENTIAL_ENCRYPTION_KEY，无法保存或读取托管凭证',
      )
    }
    return this.key
  }
}

function toPart(v: string | Buffer): string {
  return typeof v === 'string' ? v : v.toString('base64')
}

/** 接受 64 位 hex 或 base64，长度不对宁可当没配也不要用弱密钥 */
function parseKey(raw?: string): Buffer | null {
  const value = raw?.trim()
  if (!value) return null
  const buf = /^[0-9a-fA-F]{64}$/.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64')
  return buf.length === KEY_BYTES ? buf : null
}
