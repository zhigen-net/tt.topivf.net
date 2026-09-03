import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** 兜底范围的名字，出错文案里会提到，方便用户报障时说清是哪一块 */
  scope?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <div>
          <p className="font-medium">{this.props.scope ?? '页面'}加载出错了</p>
          <p className="mt-1 text-sm text-muted-foreground">
            这块内容崩了，其它功能还能用。重试一次通常就好了。
          </p>
        </div>
        <p className="max-w-lg break-all rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
          {error.message || String(error)}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => this.setState({ error: null })}>
            重试
          </Button>
          <Button onClick={() => window.location.reload()}>刷新页面</Button>
        </div>
      </div>
    )
  }
}
