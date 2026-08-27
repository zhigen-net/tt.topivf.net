import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { BrowserManager } from '../browser-manager.service'
import type { BrowserContext, Page } from 'playwright'
import { randomUUID } from 'crypto'

export type LoginSessionStatus = 'pending' | 'success' | 'failed' | 'expired'

export interface LoginSession {
  id: string
  context: BrowserContext
  page: Page
  status: LoginSessionStatus
  qrRefreshedAt: Date
  cookies?: string       // JSON 序列化的 cookie 数组
  username?: string
  displayName?: string
  avatar?: string
  createdAt: Date
  expiresAt: Date
}

const SESSION_TTL_MS = 5 * 60 * 1000  // 5 分钟
const QR_LOGIN_URL = 'https://www.tiktok.com/login/qrcode'

@Injectable()
export class TiktokLoginService {
  private readonly logger = new Logger(TiktokLoginService.name)
  private sessions = new Map<string, LoginSession>()

  constructor(private readonly browserManager: BrowserManager) {
    // 定期清理过期 session
    setInterval(() => this.cleanExpired(), 60_000)
  }

  async startSession(): Promise<{ sessionId: string; qrCodeBase64: string }> {
    const context = await this.browserManager.newStealthContext()
    const page = await context.newPage()
    this.logPassportResponses(page)

    try {
      await page.goto(QR_LOGIN_URL, { waitUntil: 'load', timeout: 30_000 })
      // 等待 JS 渲染
      await page.waitForTimeout(2_000)
      // 如果当前页面没有 qrcode 路径，尝试点击二维码登录 tab
      if (!page.url().includes('qrcode')) {
        const qrTab = await page.$('[data-e2e="qrcode-tab"], [class*="qrcode-tab"], div:has-text("使用二维码登录"), button:has-text("QR code")')
        if (qrTab) {
          await qrTab.click()
          await page.waitForTimeout(1_500)
        }
      }
    } catch (e) {
      await context.close()
      throw new Error(`无法打开 TikTok 登录页: ${e}`)
    }

    const sessionId = randomUUID()
    const now = new Date()
    const session: LoginSession = {
      id: sessionId,
      context,
      page,
      status: 'pending',
      qrRefreshedAt: now,
      createdAt: now,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    }
    this.sessions.set(sessionId, session)

    const qrCodeBase64 = await this.captureQrCode(page, sessionId)
    return { sessionId, qrCodeBase64 }
  }

  async getSessionStatus(sessionId: string): Promise<{
    status: LoginSessionStatus
    qrCodeBase64?: string
    username?: string
    displayName?: string
    avatar?: string
    cookies?: string
  }> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new NotFoundException('Session not found or expired')

    if (Date.now() > session.expiresAt.getTime()) {
      await this.closeSession(sessionId)
      return { status: 'expired' }
    }

    // 已完成
    if (session.status === 'success' || session.status === 'failed') {
      return {
        status: session.status,
        username: session.username,
        displayName: session.displayName,
        avatar: session.avatar,
        cookies: session.cookies,
      }
    }

    // 检测是否已登录
    const loggedIn = await this.checkLoginSuccess(session.context)
    if (loggedIn) {
      await this.captureSessionData(session)
      return {
        status: 'success',
        username: session.username,
        displayName: session.displayName,
        avatar: session.avatar,
        cookies: session.cookies,
      }
    }

    // 还在等待扫码 — 刷新二维码截图（TikTok 二维码会过期刷新）
    const qrCodeBase64 = await this.captureQrCode(session.page, sessionId)
    return { status: 'pending', qrCodeBase64 }
  }

  async cancelSession(sessionId: string): Promise<void> {
    await this.closeSession(sessionId)
  }

  /**
   * 扫码被拒时页面上只显示一句"请换个方式登录"，真实原因在 passport 接口的
   * error_code / description 里。轮询接口每秒都调，按 status 去重避免刷屏。
   */
  private logPassportResponses(page: Page): void {
    let lastStatus = ''
    page.on('response', (res) => {
      const url = res.url()
      if (!url.includes('/passport/web/')) return
      void res
        .json()
        .then((body: any) => {
          const status = body?.data?.status ?? ''
          const code = body?.error_code ?? body?.data?.error_code
          const key = `${status}|${code}`
          if (key === lastStatus) return
          lastStatus = key
          this.logger.log(
            `passport ${new URL(url).pathname} -> status=${status} code=${code} desc=${
              body?.description ?? body?.data?.description ?? ''
            } msg=${body?.message ?? ''}`,
          )
        })
        .catch(() => {})
    })
  }

  private async captureQrCode(page: Page, sessionId: string): Promise<string> {
    try {
      // 优先从 img src 拿 data URL（避免二次截图失真）
      const dataUrl = await page.evaluate(() => {
        const img = document.querySelector<HTMLImageElement>(
          '[class*="qrcode"] img, [class*="qr-code"] img, img[alt*="QR"], img[alt*="qr"]',
        )
        if (img?.src?.startsWith('data:')) return img.src
        // canvas 转 data URL
        const canvas = document.querySelector<HTMLCanvasElement>('[class*="qrcode"] canvas, [class*="qr-code"] canvas, canvas')
        if (canvas) {
          try { return canvas.toDataURL('image/png') } catch { /* tainted */ }
        }
        return null
      })

      if (dataUrl) {
        this.logger.log(`[${sessionId}] QR extracted from DOM`)
        return dataUrl.replace(/^data:image\/\w+;base64,/, '')
      }

      // 尝试截图元素
      const el = await page.$('[class*="qrcode"], [class*="qr-code"], [data-e2e*="qr"], canvas')
      if (el) {
        const isVisible = await el.isVisible()
        if (isVisible) {
          const buf = await el.screenshot({ type: 'png' })
          this.logger.log(`[${sessionId}] QR element screenshot ok`)
          return buf.toString('base64')
        }
      }

      // 如果有 waitForSelector 等待成功再截图，否则截整页
      const found = await page.waitForSelector(
        'canvas, [class*="qrcode"], [class*="qr-code"], [data-e2e*="qr"]',
        { timeout: 10_000 },
      ).catch(() => null)

      if (found) {
        const buf = await found.screenshot({ type: 'png' })
        this.logger.log(`[${sessionId}] QR waited + screenshot ok`)
        return buf.toString('base64')
      }
    } catch (err) {
      this.logger.warn(`[${sessionId}] QR 截图失败: ${err}`)
    }

    // 兜底：截整页
    this.logger.warn(`[${sessionId}] 回退到整页截图`)
    const buf = await page.screenshot({ type: 'png', fullPage: false })
    return buf.toString('base64')
  }

  /** sessionid cookie 是 TikTok 登录态的唯一权威标志，URL 跳转不可靠（登录页也会重定向到 /404） */
  private async checkLoginSuccess(context: BrowserContext): Promise<boolean> {
    try {
      const cookies = await context.cookies()
      return cookies.some((c) => c.name === 'sessionid' && c.value.length > 0)
    } catch {
      return false
    }
  }

  private async captureSessionData(session: LoginSession): Promise<void> {
    try {
      const rawCookies = await session.context.cookies()
      session.cookies = JSON.stringify(rawCookies)

      const username = await fetchLoggedInUsername(session.context)
      if (!username) throw new Error('登录成功但无法识别用户名')

      const profile = await this.fetchProfile(session.page, username)
      session.username = username
      session.displayName = profile?.nickname || username
      session.avatar = profile?.avatar
      session.status = 'success'

      this.logger.log(`TikTok QR login success: @${session.username}`)

      // 成功后关闭页面（保留 context 以防需要再次截图）
      await session.page.close().catch(() => {})
      // 30 秒后自动清理
      setTimeout(() => this.closeSession(session.id), 30_000)
    } catch (err) {
      this.logger.error(`Failed to capture session data: ${err}`)
      session.status = 'failed'
    }
  }

  private async fetchProfile(page: Page, username: string) {
    try {
      await page.goto(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      })
      const raw = await page.locator('#__UNIVERSAL_DATA_FOR_REHYDRATION__').textContent({ timeout: 10_000 })
      const user = raw ? JSON.parse(raw)?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo?.user : null
      if (!user) return null
      return { nickname: user.nickname as string, avatar: (user.avatarMedium || user.avatarThumb) as string }
    } catch (err) {
      this.logger.warn(`无法获取 @${username} 的资料: ${err}`)
      return null
    }
  }

  private async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    await session.context.close().catch(() => {})
    this.sessions.delete(sessionId)
  }

  private cleanExpired(): void {
    const now = Date.now()
    for (const [id, session] of this.sessions) {
      if (now > session.expiresAt.getTime()) {
        this.closeSession(id)
      }
    }
  }
}

const PASSPORT_INFO_URL =
  'https://www.tiktok.com/passport/web/account/info/?aid=1459&app_name=tiktok_web'

/** 返回当前 context 登录账号的用户名，未登录返回 null */
export async function fetchLoggedInUsername(context: BrowserContext): Promise<string | null> {
  const res = await context.request.get(PASSPORT_INFO_URL, { timeout: 15_000 })
  if (!res.ok()) return null
  const body = await res.json()
  if (body?.message !== 'success') return null
  return body?.data?.username ?? null
}
