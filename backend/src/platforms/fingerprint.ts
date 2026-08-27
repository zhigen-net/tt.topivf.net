/**
 * 把容器里的无 GPU Linux Chromium 伪装成一台普通的 Windows 桌面机。
 *
 * 伪装必须成套：UA 说 Windows 但 navigator.platform 说 Linux、或 WebGL 报
 * SwiftShader，任何一处不一致都比完全不伪装更容易被判定为自动化。
 * 因此这里同时覆盖 UA 字符串、Client Hints（JS 与 HTTP 两侧）、WebGL 渲染器
 * 和硬件参数。
 */

const CHROME_UA = (major: string) =>
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`

export interface SpoofConfig {
  webglVendor: string
  webglRenderer: string
  platformVersion: string
  hardwareConcurrency: number
  deviceMemory: number
  screen: { width: number; height: number; availHeight: number }
}

const SPOOF: SpoofConfig = {
  webglVendor: 'Google Inc. (NVIDIA)',
  webglRenderer:
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  platformVersion: '15.0.0',
  hardwareConcurrency: 8,
  deviceMemory: 8,
  screen: { width: 1920, height: 1080, availHeight: 1040 },
}

/**
 * UA 里的 Chrome 大版本必须取自真实内核版本，否则会和 userAgentData.brands
 * 上报的版本对不上；写死还会在 Playwright 升级后悄悄失效。
 */
export function buildContextOptions(browserVersion: string, timezoneId: string) {
  const major = browserVersion.split('.')[0]
  return {
    userAgent: CHROME_UA(major),
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
    timezoneId,
    extraHTTPHeaders: {
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      // Playwright 覆盖 UA 头时不会同步改 Client Hints，需要手动对齐
      'Sec-CH-UA-Platform': '"Windows"',
    },
  }
}

/** 在页面任何脚本之前执行，用 Proxy 覆写以保留原函数的 toString */
export function spoofInitScript(cfg: SpoofConfig): string {
  return `(${installSpoof.toString()})(${JSON.stringify(cfg)})`
}

export const SPOOF_CONFIG = SPOOF

function installSpoof(cfg: SpoofConfig) {
  const define = (obj: object, prop: string, value: unknown) => {
    try {
      Object.defineProperty(obj, prop, { get: () => value, configurable: true })
    } catch {
      /* 属性不可配置时放弃该项，避免抛错中断后续伪装 */
    }
  }

  define(Navigator.prototype, 'platform', 'Win32')
  define(Navigator.prototype, 'hardwareConcurrency', cfg.hardwareConcurrency)
  define(Navigator.prototype, 'deviceMemory', cfg.deviceMemory)

  define(Screen.prototype, 'width', cfg.screen.width)
  define(Screen.prototype, 'height', cfg.screen.height)
  define(Screen.prototype, 'availWidth', cfg.screen.width)
  define(Screen.prototype, 'availHeight', cfg.screen.availHeight)

  const uad = (navigator as unknown as { userAgentData?: object }).userAgentData
  if (uad) {
    const proto = Object.getPrototypeOf(uad) as {
      getHighEntropyValues: (hints: string[]) => Promise<object>
    }
    define(proto, 'platform', 'Windows')

    proto.getHighEntropyValues = new Proxy(proto.getHighEntropyValues, {
      apply: (target, thisArg, args) =>
        Reflect.apply(target, thisArg, args).then((values: object) => ({
          ...values,
          platform: 'Windows',
          platformVersion: cfg.platformVersion,
          architecture: 'x86',
          bitness: '64',
          model: '',
        })),
    })
  }

  // 37445 = UNMASKED_VENDOR_WEBGL, 37446 = UNMASKED_RENDERER_WEBGL
  const patchWebgl = (proto: { getParameter: (n: number) => unknown } | undefined) => {
    if (!proto) return
    proto.getParameter = new Proxy(proto.getParameter, {
      apply: (target, thisArg, args) => {
        if (args[0] === 37445) return cfg.webglVendor
        if (args[0] === 37446) return cfg.webglRenderer
        return Reflect.apply(target, thisArg, args)
      },
    })
  }
  patchWebgl((window as any).WebGLRenderingContext?.prototype)
  patchWebgl((window as any).WebGL2RenderingContext?.prototype)
}
