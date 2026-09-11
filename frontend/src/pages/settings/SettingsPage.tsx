import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { KeyRound, Clock, Type } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useSiteName } from '@/lib/site'

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">系统设置</h1>
        <p className="text-muted-foreground text-sm mt-1">
          环境信息与各项配置的入口。个人资料在左下角头像里改，MCP 接入在「MCP 服务」里管
        </p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <SiteNameCard />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              平台凭证
            </CardTitle>
            <CardDescription>
              各平台的 API Key 与 OAuth 凭证<b className="font-medium">按工作空间分别保管</b>，
              不是全站共用的，所以入口在工作空间里
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link to="/workspace/credentials">前往平台凭据</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              时区
            </CardTitle>
            <CardDescription>影响你填写和查看发布时间的方式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium tabular-nums">
                {localZoneName()} · {utcOffsetLabel()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">来自你当前的浏览器</p>
            </div>
            {/* 系统没有「全站时区」这个概念：排期一律按 UTC 时间戳存和比较，
                填写与展示都走浏览器本地时区。说清楚，免得跨时区协作时填错点 */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              排期时间按上面这个时区解释，存进数据库时统一转成 UTC。
              和同事跨时区对时间时，请以对方浏览器所在时区为准。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SiteNameCard() {
  const qc = useQueryClient()
  const siteName = useSiteName()
  const [name, setName] = useState(siteName)

  // 首次渲染时查询还没回来，拿到的是默认值，得等真值到了再同步一次
  useEffect(() => setName(siteName), [siteName])

  const save = useMutation({
    mutationFn: () => api.patch('/settings', { siteName: name.trim() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['site-settings'] }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Type className="h-4 w-4 text-muted-foreground" />
          系统名称
        </CardTitle>
        <CardDescription>显示在登录页、侧边栏和浏览器标签上，全站共用</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1 space-y-1.5">
          <Label htmlFor="site-name">名称</Label>
          <Input
            id="site-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
          />
        </div>
        <Button
          onClick={() => save.mutate()}
          disabled={!name.trim() || name.trim() === siteName || save.isPending}
        >
          {save.isPending ? '保存中…' : '保存'}
        </Button>
        {save.isError && <p className="w-full text-sm text-destructive">{errorText(save.error)}</p>}
      </CardContent>
    </Card>
  )
}

function errorText(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string | string[] } | undefined)?.message
    if (Array.isArray(msg)) return msg.join('；')
    if (msg) return msg
  }
  return '保存失败，请重试。'
}

function localZoneName() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || '未知时区'
}

/** getTimezoneOffset 返回的是「UTC 减本地」的分钟数，所以东八区拿到 -480 */
function utcOffsetLabel() {
  const total = -new Date().getTimezoneOffset()
  const sign = total < 0 ? '-' : '+'
  const abs = Math.abs(total)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}
