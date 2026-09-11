/**
 * 域名挂在 Cloudflare 后面，边缘对请求体卡 100MB，超了在边缘就被截成 413，
 * 后端根本收不到（后端自己的 ASSET_MAX_SIZE 是 200MB，量不到这一层）。
 * 这里留点余量给 multipart 的包头。
 */
export const UPLOAD_MAX_SIZE = 95 * 1024 * 1024

/** 超限就返回给用户看的原因，没超返回 null */
export function tooLargeReason(file: File): string | null {
  if (file.size <= UPLOAD_MAX_SIZE) return null
  const mb = (file.size / 1024 / 1024).toFixed(0)
  return `这个文件 ${mb} MB，超过了 95 MB 上限（CDN 对上传体积的限制，不是服务端）。请先压缩视频或截成更短的片段。`
}
