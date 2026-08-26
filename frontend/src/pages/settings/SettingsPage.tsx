import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your application settings</p>
      </div>

      <div className="space-y-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform Credentials</CardTitle>
            <CardDescription>API keys and OAuth credentials for each platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(['tiktok', 'instagram', 'youtube', 'twitter', 'facebook'] as const).map((p) => (
              <div key={p} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm capitalize font-medium">{p}</span>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
            <CardDescription>Timezone and scheduling preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Timezone</p>
                <p className="text-xs text-muted-foreground">UTC+0</p>
              </div>
              <Button variant="outline" size="sm">
                Change
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
