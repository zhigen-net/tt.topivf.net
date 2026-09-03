import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChangePasswordDialog } from '@/components/users/ChangePasswordDialog'
import { McpKeysCard } from '@/components/settings/McpKeysCard'
import { useMe } from '@/lib/auth'
import { useWorkspace } from '@/lib/workspace'

export default function SettingsPage() {
  const { me } = useMe()
  const { can } = useWorkspace()
  const [passwordOpen, setPasswordOpen] = useState(false)

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">设置</h1>
        <p className="text-muted-foreground text-sm mt-1">管理系统与账号设置</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">账号</CardTitle>
            <CardDescription>当前登录：{me ? `${me.displayName}（@${me.username}）` : '—'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">登录密码</p>
                <p className="text-xs text-muted-foreground">定期更换，避免与其它系统共用</p>
              </div>
              <Button className="shrink-0" variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>修改密码</Button>
            </div>
          </CardContent>
        </Card>

        {can('member') && <McpKeysCard />}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">平台凭证</CardTitle>
            <CardDescription>各平台的 API Key 与 OAuth 凭证</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(['tiktok', 'instagram', 'youtube', 'twitter', 'facebook'] as const).map((p) => (
              <div key={p} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm capitalize font-medium">{p}</span>
                <Button variant="outline" size="sm">
                  配置
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">通用</CardTitle>
            <CardDescription>时区与排期偏好</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">时区</p>
                <p className="text-xs text-muted-foreground">UTC+0</p>
              </div>
              <Button className="shrink-0" variant="outline" size="sm">
                修改
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}
