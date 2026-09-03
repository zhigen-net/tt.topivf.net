import { BadRequestException } from '@nestjs/common'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { isIP, type LookupFunction } from 'node:net'
import { basename } from 'node:path'

const MAX_REDIRECTS = 3
const TIMEOUT_MS = 30_000

export interface RemoteFile {
  buffer: Buffer
  mimeType: string
  filename: string
}

/**
 * 按 URL 把远端文件拉进来。调用方给的地址来自 AI，等于让服务器去连一个它说了算的目标，
 * 所以这里必须挡住内网：云厂商的元数据地址（169.254.169.254）、容器网里的 minio 和
 * postgres，都是从这条路能摸到的东西。
 */
export async function fetchRemoteFile(rawUrl: string, maxSize: number): Promise<RemoteFile> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BadRequestException('素材地址不是合法的 URL')
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException(`只支持 http/https，收到的是 ${url.protocol}`)
    }
    assertHostAllowed(url)

    const res = await send(url)
    const status = res.statusCode ?? 0

    // 跳转目标要重新过一遍闸：公网地址 302 到 127.0.0.1 是最常见的绕过手法
    if (status >= 300 && status < 400 && res.headers.location) {
      res.destroy()
      url = new URL(res.headers.location, url)
      continue
    }
    if (status !== 200) {
      res.destroy()
      throw new BadRequestException(`拉取素材失败，对方返回 HTTP ${status}`)
    }
    return collect(res, url, maxSize)
  }

  throw new BadRequestException('素材地址重定向次数过多')
}

/**
 * 地址里直接写 IP 时，net.connect 认出它是 IP 就不走 DNS 了，下面那个 lookup 钩子
 * 压根不会被调用——http://169.254.169.254/ 会一路畅通。所以字面量得在这里单独拦。
 */
function assertHostAllowed(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && isBlockedAddress(host)) {
    throw new BadRequestException(`不允许访问内网地址：${host}`)
  }
}

function send(url: URL): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest
    const req = request(
      url,
      { lookup: guardedLookup, timeout: TIMEOUT_MS, headers: { 'user-agent': 'SocialHub', accept: '*/*' } },
      resolve,
    )
    req.on('timeout', () => req.destroy(new BadRequestException('拉取素材超时')))
    req.on('error', reject)
    req.end()
  })
}

function collect(res: IncomingMessage, url: URL, maxSize: number): Promise<RemoteFile> {
  return new Promise((resolve, reject) => {
    const declared = Number(res.headers['content-length'])
    if (declared > maxSize) {
      res.destroy()
      reject(new BadRequestException(`素材有 ${declared} 字节，超过上限 ${maxSize}`))
      return
    }

    const chunks: Buffer[] = []
    let size = 0
    res.on('data', (chunk: Buffer) => {
      size += chunk.length
      // Content-Length 是对方随便填的，边收边卡才真的拦得住
      if (size > maxSize) {
        res.destroy()
        reject(new BadRequestException(`素材超过大小上限 ${maxSize} 字节`))
        return
      }
      chunks.push(chunk)
    })
    res.on('error', reject)
    res.on('end', () => resolve({
      buffer: Buffer.concat(chunks),
      mimeType: (res.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase(),
      filename: filenameFrom(url),
    }))
  })
}

/**
 * 在 net 真正发起连接的那一刻校验 IP。先 dns.lookup 校验再 fetch 会留一个窗口，
 * 域名可以在两次解析之间改指向（DNS rebinding），挂在这个钩子上就没有这个空隙。
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...(options as object), all: true }, (err, addresses: LookupAddress[]) => {
    if (err) {
      callback(err, '', 0)
      return
    }
    const allowed = addresses.filter((a) => !isBlockedAddress(a.address))
    if (!allowed.length) {
      callback(new BadRequestException(`不允许访问内网地址：${hostname}`), '', 0)
      return
    }
    const all = (options as { all?: boolean }).all
    if (all) callback(null, allowed as never, 0)
    else callback(null, allowed[0].address, allowed[0].family)
  })
}

export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isBlockedV4(ip)
  if (version === 6) return isBlockedV6(ip)
  return true
}

function isBlockedV4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true

  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 169 && b === 254) return true // 云元数据服务就住在这段
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && (b === 0 || b === 168)) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true // 组播与保留段
  return false
}

function isBlockedV6(ip: string): boolean {
  // 必须展开成 8 组再判：URL 会把 ::ffff:127.0.0.1 规范化成 ::ffff:7f00:1，
  // 按字符串匹配点分写法的话，这条通往回环的路就漏过去了
  const g = expandV6(ip.toLowerCase().split('%')[0])
  if (!g) return true

  const embedded = embeddedV4(g)
  if (embedded) return isBlockedV4(embedded)

  if (g[0] >= 0xfc00 && g[0] <= 0xfdff) return true // fc00::/7 唯一本地
  if (g[0] >= 0xfe80 && g[0] <= 0xfebf) return true // fe80::/10 链路本地
  if (g[0] >= 0xff00) return true // ff00::/8 组播
  return false
}

/** v4 映射 ::ffff:a.b.c.d、v4 兼容 ::a.b.c.d、以及 NAT64 的 64:ff9b::/96 */
function embeddedV4(g: number[]): string | null {
  const zeroLead = g.slice(0, 5).every((n) => n === 0)
  const nat64 = g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((n) => n === 0)
  if (!zeroLead && !nat64) return null
  if (zeroLead && g[5] !== 0 && g[5] !== 0xffff) return null

  return `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`
}

function expandV6(addr: string): number[] | null {
  let rest = addr
  // 尾巴上的点分十进制先折成两组十六进制
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(rest)
  if (tail) {
    const p = tail[1].split('.').map(Number)
    if (p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
    rest = rest.slice(0, tail.index)
      + `${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`
  }

  const halves = rest.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const back = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const groups = halves.length === 2
    ? [...head, ...Array<string>(8 - head.length - back.length).fill('0'), ...back]
    : head

  if (groups.length !== 8) return null
  const nums = groups.map((s) => (/^[0-9a-f]{1,4}$/.test(s) ? parseInt(s, 16) : NaN))
  return nums.some(Number.isNaN) ? null : nums
}

function filenameFrom(url: URL): string {
  try {
    const name = basename(decodeURIComponent(url.pathname))
    if (name && name !== '/') return name.slice(0, 200)
  } catch {
    // pathname 里有半个百分号转义就会抛，退回默认名即可
  }
  return 'remote-asset'
}
