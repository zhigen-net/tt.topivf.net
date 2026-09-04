import { Controller, Get, Header, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { TiktokOauthService } from './tiktok-oauth.service'
import { Public } from '../../auth/public.decorator'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from '../../workspaces/workspace-context'

@ApiTags('tiktok')
@Controller('tiktok/oauth')
export class TiktokOauthController {
  constructor(private readonly svc: TiktokOauthService) {}

  @ApiBearerAuth()
  @MinWorkspaceRole('manager')
  @Post('start')
  start(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.start(ws.id)
  }

  /**
   * TikTok 把浏览器直接重定向到这里，带不上 Bearer，所以必须是公开路由。
   * 真正的准入控制在 state 上：它是我们签发的一次性随机串，十分钟过期。
   */
  @Public()
  @Get('callback')
  @Header('content-type', 'text/html; charset=utf-8')
  async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') description?: string,
  ) {
    if (error) return page(false, description || error)
    if (!code || !state) return page(false, '回调缺少 code 或 state')

    try {
      const res = await this.svc.complete(code, state)
      return page(true, `@${res.username} 已接入`)
    } catch (err) {
      return page(false, err instanceof Error ? err.message : String(err))
    }
  }
}

/** 授权在新窗口里完成，结果得回传给开着的那个页面，然后自己关掉 */
function page(ok: boolean, message: string): string {
  // 平台返回的错误文案会原样进 <script>，不转义 < 就能用 </script> 闭合标签逃逸出去
  const payload = JSON.stringify({ source: 'tiktok-oauth', ok, message }).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>TikTok 授权</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;margin:0;
align-items:center;justify-content:center;background:#fafafa;color:#111}
.box{text-align:center;padding:2rem}.t{font-size:1.1rem;font-weight:600;margin-bottom:.5rem}
.m{font-size:.875rem;color:#666}</style></head>
<body><div class="box">
<div class="t">${ok ? 'TikTok 授权成功' : 'TikTok 授权失败'}</div>
<div class="m">${escapeHtml(message)}</div>
</div>
<script>
  try { window.opener && window.opener.postMessage(${payload}, '*') } catch (e) {}
  setTimeout(function () { window.close() }, ${ok ? 1200 : 4000});
</script></body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
