import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { chromium, Browser, BrowserContext } from 'playwright'
import type { Account } from '../accounts/account.entity'
import type { Proxy } from '../proxies/proxy.entity'

@Injectable()
export class BrowserManager implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserManager.name)
  private browser: Browser | null = null
  private contexts = new Map<string, BrowserContext>()

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.logger.log('Launching Chromium…')
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      })
      this.logger.log('Chromium launched')
    }
    return this.browser
  }

  async getContext(account: Account): Promise<BrowserContext> {
    const existing = this.contexts.get(account.id)
    if (existing) return existing

    const browser = await this.getBrowser()

    const context = await browser.newContext({
      proxy: account.proxy ? buildProxyConfig(account.proxy) : undefined,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      // Hide WebDriver flag
      extraHTTPHeaders: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
    })

    // Remove navigator.webdriver fingerprint
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })

    await this.injectCookies(context, account)

    this.contexts.set(account.id, context)
    this.logger.log(`Context created for account ${account.username} (${account.platform})`)
    return context
  }

  /** 刷新 context 的 cookies（cookie 更新后调用） */
  async refreshContext(account: Account): Promise<BrowserContext> {
    await this.closeContext(account.id)
    return this.getContext(account)
  }

  async closeContext(accountId: string): Promise<void> {
    const ctx = this.contexts.get(accountId)
    if (ctx) {
      await ctx.close().catch(() => {})
      this.contexts.delete(accountId)
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const ctx of this.contexts.values()) {
      await ctx.close().catch(() => {})
    }
    this.contexts.clear()
    if (this.browser) {
      await this.browser.close().catch(() => {})
      this.browser = null
    }
  }

  private async injectCookies(context: BrowserContext, account: Account): Promise<void> {
    const raw = account.sessionData?.cookies
    if (!raw) return

    try {
      let cookies: Array<Record<string, unknown>>

      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        if (trimmed.startsWith('[')) {
          // JSON array format (from EditThisCookie / Cookie Editor extension)
          cookies = JSON.parse(trimmed)
        } else {
          // "name=value; name2=value2" header string format
          cookies = trimmed.split(';').map((pair) => {
            const idx = pair.indexOf('=')
            return {
              name: pair.slice(0, idx).trim(),
              value: pair.slice(idx + 1).trim(),
              domain: `.${platformDomain(account.platform)}`,
              path: '/',
            }
          }).filter((c) => c.name && c.value)
        }
      } else if (Array.isArray(raw)) {
        cookies = raw as Array<Record<string, unknown>>
      } else {
        return
      }

      // Playwright requires sameSite to be a specific string union
      const normalized = cookies.map((c) => ({
        name: String(c.name),
        value: String(c.value),
        domain: c.domain ? String(c.domain) : `.${platformDomain(account.platform)}`,
        path: c.path ? String(c.path) : '/',
        httpOnly: Boolean(c.httpOnly),
        secure: Boolean(c.secure),
        sameSite: normalizeSameSite(c.sameSite),
        expires: typeof c.expirationDate === 'number' ? c.expirationDate :
                 typeof c.expires === 'number' ? c.expires : undefined,
      }))

      await context.addCookies(normalized)
      this.logger.log(`Injected ${normalized.length} cookies for ${account.username}`)
    } catch (err) {
      this.logger.warn(`Failed to inject cookies for ${account.username}: ${err}`)
    }
  }
}

function buildProxyConfig(proxy: Proxy) {
  const server = `${proxy.protocol}://${proxy.host}:${proxy.port}`
  return {
    server,
    username: proxy.username,
    password: proxy.password,
  }
}

function platformDomain(platform: string): string {
  const map: Record<string, string> = {
    tiktok: 'tiktok.com',
    instagram: 'instagram.com',
    youtube: 'youtube.com',
    twitter: 'twitter.com',
    facebook: 'facebook.com',
  }
  return map[platform] ?? platform
}

function normalizeSameSite(v: unknown): 'Strict' | 'Lax' | 'None' | undefined {
  if (!v) return undefined
  const s = String(v)
  if (s === 'Strict' || s === 'strict') return 'Strict'
  if (s === 'Lax' || s === 'lax') return 'Lax'
  if (s === 'None' || s === 'none' || s === 'no_restriction') return 'None'
  return undefined
}
