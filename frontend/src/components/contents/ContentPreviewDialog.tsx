import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useAllAccounts } from '@/lib/accounts'
import { cn } from '@/lib/utils'
import { contentTypeLabel, platformLabel } from './constants'
import { FacebookPreview, GenericPreview, InstagramPreview } from './PlatformPreview'
import type { Content, ContentPreviewMedia, Platform } from '@/types'

/** 只有这两个平台是照着真实界面还原的，其余平台走通用版式 */
const styledPlatforms: Platform[] = ['facebook', 'instagram']

interface Props {
  content: Content
  onClose: () => void
}

export function ContentPreviewDialog({ content, onClose }: Props) {
  // 作品可以不选平台，那样至少给个通用版式，不能开出一个空弹层
  const platforms = content.platforms.length ? content.platforms : (['facebook'] as Platform[])
  const [platform, setPlatform] = useState<Platform>(platforms[0])
  const [accountId, setAccountId] = useState('')

  const { data: media, isPending, isError } = useQuery({
    queryKey: ['content-preview', content.id],
    queryFn: () => api.get<ContentPreviewMedia>(`/contents/${content.id}/preview`).then((r) => r.data),
    // 直链十分钟过期，关掉弹层再打开就该重新签一份
    gcTime: 0,
    staleTime: 0,
  })

  const accounts = useAllAccounts()
  const candidates = useMemo(
    () => accounts.filter((a) => a.platform === platform),
    [accounts, platform],
  )
  const account = candidates.find((a) => a.id === accountId) ?? candidates[0]

  const props = { content, media, account }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate pr-6 text-base">{content.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm',
                p === platform ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {platformLabel[p]}
            </button>
          ))}

          <span className="ml-auto text-xs text-muted-foreground">{contentTypeLabel[content.type]}</span>

          {candidates.length > 0 && (
            <Select value={account?.id ?? ''} onValueChange={setAccountId}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.displayName || a.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex justify-center rounded-lg bg-neutral-100 py-6 dark:bg-neutral-800">
          {isPending ? (
            <Loader2 className="my-16 h-6 w-6 animate-spin text-muted-foreground" />
          ) : isError ? (
            <p className="my-16 text-sm text-muted-foreground">媒体直链取不到，稍后再试</p>
          ) : platform === 'facebook' ? (
            <FacebookPreview {...props} />
          ) : platform === 'instagram' ? (
            <InstagramPreview {...props} />
          ) : (
            <GenericPreview {...props} />
          )}
        </div>

        {!styledPlatforms.includes(platform) && (
          <p className="text-xs text-muted-foreground">
            {platformLabel[platform]} 还没接入发布接口，这里只按版式给个大概，不是该平台的真实界面。
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
