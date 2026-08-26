import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your account performance</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Follower Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Connect accounts to see growth data.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Connect accounts to see engagement data.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
