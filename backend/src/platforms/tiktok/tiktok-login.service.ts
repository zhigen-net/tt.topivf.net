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
const QR_LOGIN_URL = 'https://www.tiktok.com/login/phone-or-email/qr-code'

@Injectable()
export class TiktokLoginService {
  private readonly logger = new Logger(TiktokLoginService.name)
  private sessions = new Map<string, LoginSession>()

  constructor(private readonly browserManager: BrowserManager) {
    // 定期清理过期 session
    setInterval(() => this.cleanExpired(), 60_000)
  }

  async startSession(): Promise<{ sessionId: string; qrCodeBase64: string }> {
    const browser = await (this.browserManager as any).getBrowser()
    const context: BrowserContext = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'zh-CN',
    })
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })

    const page = await context.newPage()

    try {
      await page.goto(QR_LOGIN_URL, { waitUntil: 'load', timeout: 30_000 })
      // 等待 JS 渲染
      await page.waitForTimeout(2_000)
      // 如果当前页面没有 qr-code 路径，尝试点击二维码登录 tab
      if (!page.url().includes('qr-code')) {
        const qrTab = await page.$('[data-e2e="qrcode-tab"], [class*="qrcode-tab"], button:has-text("QR code"), button:has-text("二维码")')
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
    const loggedIn = await this.checkLoginSuccess(session.page)
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

  private async checkLoginSuccess(page: Page): Promise<boolean> {
    try {
      const url = page.url()
      // 扫码成功后会跳转离开登录页
      if (!url.includes('/login') && !url.includes('/qr-code')) {
        return true
      }
      // 或者检测页面上是否出现了用户头像元素
      const avatar = await page.$('[data-e2e="user-avatar"], [class*="avatar-wrapper"]')
      return !!avatar
    } catch {
      return false
    }
  }

  private async captureSessionData(session: LoginSession): Promise<void> {
    try {
      const rawCookies = await session.context.cookies()
      session.cookies = JSON.stringify(rawCookies)

      // 尝试从页面提取用户信息
      await session.page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {})

      const info = await session.page.evaluate(() => {
        // TikTok 在 window 上注入全局数据
        const data = (window as any).__UNIVERSAL_DATA__ || (window as any).__INIT_PROPS__
        try {
          const userDetail =
            data?.['webapp.user-detail']?.userInfo?.user ||
            data?.userInfo?.user
          if (userDetail) {
            return {
              username: userDetail.uniqueId,
              displayName: userDetail.nickname,
              avatar: userDetail.avatarThumb || userDetail.avatarMedium,
            }
          }
        } catch {}

        // 降级：从 DOM 找
        const usernameEl = document.querySelector('[data-e2e="user-name"], [class*="username"]')
        const avatarEl = document.querySelector<HTMLImageElement>('[data-e2e="user-avatar"] img, [class*="avatar"] img')
        return {
          username: usernameEl?.textContent?.replace('@', '').trim() || undefined,
          displayName: usernameEl?.textContent?.trim() || undefined,
          avatar: avatarEl?.src || undefined,
        }
      })

      session.username = info?.username
      session.displayName = info?.displayName || info?.username
      session.avatar = info?.avatar
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
