import { TiktokApiError } from './tiktok-api'

const MIN_CHUNK = 5 * 1024 * 1024
const MAX_CHUNK = 64 * 1024 * 1024
const UPLOAD_TIMEOUT_MS = 10 * 60_000

export interface ChunkPlan {
  chunkSize: number
  totalChunks: number
}

/**
 * TikTok 对分片的要求很死：单片 5MB~64MB，且 total_chunk_count 必须等于
 * floor(size / chunk_size)——余数不是单独一片，而是并进最后一片里。
 * 小于 5MB 的文件不许分片，只能整个当成一片传。
 */
export function planChunks(size: number): ChunkPlan {
  if (size <= 0) throw new TiktokApiError('invalid_file', '视频文件为空')
  if (size < MIN_CHUNK) return { chunkSize: size, totalChunks: 1 }

  const chunkSize = Math.min(MAX_CHUNK, size)
  return { chunkSize, totalChunks: Math.floor(size / chunkSize) }
}

/** 第 i 片的字节区间，最后一片吃掉所有余数 */
export function chunkRange(i: number, plan: ChunkPlan, size: number): [number, number] {
  const start = i * plan.chunkSize
  const end = i === plan.totalChunks - 1 ? size - 1 : start + plan.chunkSize - 1
  return [start, end]
}

export async function uploadChunks(
  uploadUrl: string,
  file: Buffer,
  mimeType: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const size = file.length
  const plan = planChunks(size)

  for (let i = 0; i < plan.totalChunks; i++) {
    const [start, end] = chunkRange(i, plan, size)
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': mimeType,
        'content-length': String(end - start + 1),
        'content-range': `bytes ${start}-${end}/${size}`,
      },
      body: new Uint8Array(file.subarray(start, end + 1)),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    })

    // 分片上传走的是裸 HTTP，不是 open.tiktokapis 那套信封，只能看状态码
    if (!res.ok && res.status !== 308) {
      const detail = await res.text().catch(() => '')
      throw new TiktokApiError(
        `upload_${res.status}`,
        `分片 ${i + 1}/${plan.totalChunks} 上传失败：HTTP ${res.status} ${detail.slice(0, 200)}`,
      )
    }
    onProgress?.(i + 1, plan.totalChunks)
  }
}
