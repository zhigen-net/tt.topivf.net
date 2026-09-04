import { Injectable, Logger } from '@nestjs/common'
import { PlatformAdapter, PostResult, AccountStats } from '../platform.adapter'
import { BrowserManager } from '../browser-manager.service'
import { fetchLoggedInUsername } from './tiktok-login.service'
import type { Account } from '../../accounts/account.entity'
import type { Content } from '../../contents/content.entity'

const UPLOAD_URL = 'https://www.tiktok.com/creator-center/upload'
const TIMEOUT = 60_000

@Injectable()
export class TiktokBrowserAdapter extends PlatformAdapter {
  readonly platform = 'tiktok'
  private readonly logger = new Logger(TiktokBrowserAdapter.name)

  constructor(private readonly browserManager: BrowserManager) {
    super()
  }

  async publish(account: Account, content: Content): Promise<PostResult> {
    if (!content.fileUrl) {
      return { success: false, error: 'Content has no fileUrl' }
    }

    this.logger.log(`Publishing to TikTok for @${account.username}`)
    const context = await this.browserManager.getContext(account)
    const page = await context.newPage()

    try {
      // 导航到上传页
      await page.goto(UPLOAD_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })

      // 检测登录状态
      const isLoggedIn = await this.checkLogin(page)
      if (!isLoggedIn) {
        this.logger.warn(`Account @${account.username} not logged in — cookies may have expired`)
        // 清除失效 context，下次重新注入
        await this.browserManager.closeContext(account.id)
        return { success: false, error: 'Cookie expired, please re-login' }
      }

      // 等待上传区域出现（可能在 iframe 内）
      const frame = await this.resolveUploadFrame(page)

      // 找到文件 input 并上传
      const fileInput = await frame.waitForSelector('input[type="file"]', { timeout: TIMEOUT })

      // 从 URL 下载文件内容后注入
      const fileBuffer = await fetchBuffer(content.fileUrl)
      const fileName = extractFileName(content.fileUrl, content.type)
      await fileInput.setInputFiles({
        name: fileName,
        mimeType: videoMimeType(fileName),
        buffer: fileBuffer,
      })
      this.logger.log(`File uploaded for @${account.username}, waiting for processing…`)

      // 等待上传进度条消失（视频处理完成）
      await frame.waitForFunction(
        () => !document.querySelector('[class*="upload-progress"], [class*="uploading"]'),
        { timeout: 120_000 },
      ).catch(() => this.logger.warn('Upload progress selector not found, continuing…'))

      // 等待文案输入框出现
      const captionBox = await frame.waitForSelector(
        '[data-e2e="caption-input"], [contenteditable="true"], textarea[placeholder*="caption"], textarea[placeholder*="描述"]',
        { timeout: TIMEOUT },
      ).catch(() => null)

      if (captionBox) {
        const caption = buildCaption(content)
        await captionBox.click()
        await captionBox.fill(caption)
      }

      // 点击发布按钮
      const postBtn = await frame.waitForSelector(
        '[data-e2e="post-button"], button:has-text("Post"), button:has-text("发布")',
        { timeout: TIMEOUT },
      )
      await postBtn.click()

      // 等待成功跳转或成功提示
      await Promise.race([
        page.waitForNavigation({ timeout: 30_000 }).catch(() => {}),
        page.waitForSelector('[class*="success"], [data-e2e="upload-success"]', { timeout: 30_000 }).catch(() => {}),
      ])

      // 尝试获取发布后的 URL
      const postUrl = page.url().includes('tiktok.com/@') ? page.url() : undefined

      this.logger.log(`Published to TikTok for @${account.username}${postUrl ? ` → ${postUrl}` : ''}`)
      return { success: true, postUrl }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`TikTok publish failed for @${account.username}: ${msg}`)

      // 截图保存以便调试
      await page.screenshot({ path: `/tmp/tiktok-error-${account.id}.png` }).catch(() => {})

      return { success: false, error: msg }
    } finally {
      await page.close()
    }
  }

  async fetchStats(account: Account): Promise<AccountStats> {
    const context = await this.browserManager.getContext(account)
    const page = await context.newPage()
    try {
      await page.goto(
        `https://www.tiktok.com/@${encodeURIComponent(account.username)}`,
        { waitUntil: 'load', timeout: 30_000 },
      )
      const raw = await page
        .locator('#__UNIVERSAL_DATA_FOR_REHYDRATION__')
        .textContent({ timeout: 10_000 })
        .catch(() => null)

      const s = raw
        ? JSON.parse(raw)?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo?.stats
        : null

      if (s && typeof s.followerCount === 'number') {
        this.logger.log(`fetchStats ok for @${account.username}: ${s.followerCount} followers`)
        return {
          followers: s.followerCount,
          following: s.followingCount ?? 0,
          postsCount: s.videoCount ?? 0,
        }
      }
      this.logger.warn(`fetchStats: no user-detail stats for @${account.username}`)
    } catch (err) {
      this.logger.warn(`fetchStats browser failed for @${account.username}: ${err}`)
    } finally {
      await page.close()
    }
    return {
      followers: account.followers,
      following: account.following,
      postsCount: account.postsCount,
    }
  }

  async checkHealth(account: Account): Promise<boolean> {
    if (!account.sessionData?.cookies) return false
    const context = await this.browserManager.getContext(account)
    try {
      return (await fetchLoggedInUsername(context)) !== null
    } catch (err) {
      this.logger.warn(`checkHealth failed for @${account.username}: ${err}`)
      return false
    }
  }

  private async checkLogin(page: import('playwright').Page): Promise<boolean> {
    try {
      // TikTok 登录后会有用户头像或账号信息
      const url = page.url()
      if (url.includes('/login')) return false

      const loginBtn = await page.$('[data-e2e="login-button"], a[href*="/login"]')
      return !loginBtn
    } catch {
      return false
    }
  }

  private async resolveUploadFrame(page: import('playwright').Page) {
    // TikTok 上传表单有时在 iframe 内
    const iframe = page.frames().find((f) => f.url().includes('creator-center') || f.url().includes('upload'))
    return iframe ?? page.mainFrame()
  }
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`)
  return Buffer.from(await res.arrayBuffer())
}

function extractFileName(url: string, type: string): string {
  const fromUrl = url.split('/').pop()?.split('?')[0]
  if (fromUrl && fromUrl.includes('.')) return fromUrl
  const ext = type === 'image' ? 'jpg' : 'mp4'
  return `content.${ext}`
}

function videoMimeType(name: string): string {
  if (name.endsWith('.mov')) return 'video/quicktime'
  if (name.endsWith('.avi')) return 'video/x-msvideo'
  if (name.endsWith('.webm')) return 'video/webm'
  return 'video/mp4'
}

function buildCaption(content: Content): string {
  const tags = content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
  return [content.caption, tags].filter(Boolean).join('\n\n')
}
