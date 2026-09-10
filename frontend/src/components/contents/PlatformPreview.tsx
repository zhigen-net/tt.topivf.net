import { Bookmark, Heart, MessageCircle, MoreHorizontal, Music, Send, Share2, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Account, Content, ContentPreviewMedia } from '@/types'

/**
 * 和后端 buildMessage / buildCaption 保持一致（facebook.adapter.ts、instagram.adapter.ts）：
 * 正文和标签之间空一行。这里改了那边也要改，否则预览和发出去的不是一个东西。
 */
export function composeCaption(content: Content): string {
  const tags = content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
  return [content.caption, tags].filter(Boolean).join('\n\n')
}

interface PreviewProps {
  content: Content
  media: ContentPreviewMedia | undefined
  account?: Account
}

/** 竖版：Reel 和快拍是 9:16，普通图文按平台各自的取景走 */
const isVertical = (t: Content['type']) => t === 'reel' || t === 'story'

export function FacebookPreview({ content, media, account }: PreviewProps) {
  const caption = composeCaption(content)

  return (
    <Frame width="w-[420px]">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Avatar account={account} size="h-10 w-10" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight">
            {account?.displayName ?? '你的主页'}
          </p>
          <p className="text-xs text-neutral-500">刚刚 · 公开</p>
        </div>
        <MoreHorizontal className="ml-auto h-5 w-5 shrink-0 text-neutral-500" />
      </div>

      {caption && (
        <p className="whitespace-pre-wrap px-3 py-2 text-[15px] leading-snug">
          <Caption text={caption} linkClass="text-[#0866ff]" />
        </p>
      )}

      <Media media={media} className={isVertical(content.type) ? 'aspect-[9/16]' : 'max-h-[420px]'} />

      <div className="flex items-center gap-1 px-3 py-2 text-[13px] text-neutral-500">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0866ff]">
          <ThumbsUp className="h-2.5 w-2.5 text-white" />
        </span>
        <span>128</span>
        <span className="ml-auto">12 条评论 · 3 次分享</span>
      </div>

      <div className="mx-3 grid grid-cols-3 border-t border-neutral-200 py-1 text-[15px] font-medium text-neutral-600">
        <FbAction icon={<ThumbsUp className="h-[18px] w-[18px]" />} label="赞" />
        <FbAction icon={<MessageCircle className="h-[18px] w-[18px]" />} label="评论" />
        <FbAction icon={<Share2 className="h-[18px] w-[18px]" />} label="分享" />
      </div>
    </Frame>
  )
}

export function InstagramPreview({ content, media, account }: PreviewProps) {
  const caption = composeCaption(content)
  const name = account?.username ?? 'your_account'

  if (content.type === 'story') {
    return (
      <Frame width="w-[280px]" className="relative aspect-[9/16] overflow-hidden bg-black">
        <Media media={media} className="absolute inset-0 h-full w-full" fit="cover" />
        <div className="absolute inset-x-0 top-0 space-y-2 bg-gradient-to-b from-black/60 to-transparent p-3">
          <div className="h-0.5 rounded-full bg-white/90" />
          <div className="flex items-center gap-2">
            <Avatar account={account} size="h-7 w-7" />
            <span className="text-xs font-semibold text-white">{name}</span>
            <span className="text-xs text-white/70">刚刚</span>
          </div>
        </div>
        {caption && (
          <p className="absolute inset-x-3 bottom-14 line-clamp-4 whitespace-pre-wrap text-center text-sm text-white drop-shadow">
            {caption}
          </p>
        )}
        <div className="absolute inset-x-3 bottom-3 rounded-full border border-white/60 px-3 py-1.5 text-xs text-white/80">
          发送消息…
        </div>
      </Frame>
    )
  }

  if (content.type === 'reel') {
    return (
      <Frame width="w-[280px]" className="relative aspect-[9/16] overflow-hidden bg-black">
        <Media media={media} className="absolute inset-0 h-full w-full" fit="cover" />
        <span className="absolute left-3 top-3 text-sm font-semibold text-white drop-shadow">Reels</span>

        <div className="absolute bottom-3 right-2 flex flex-col items-center gap-4 text-white">
          <IgSideIcon icon={<Heart className="h-6 w-6" />} label="1.2万" />
          <IgSideIcon icon={<MessageCircle className="h-6 w-6" />} label="86" />
          <IgSideIcon icon={<Send className="h-6 w-6" />} label="分享" />
          <MoreHorizontal className="h-5 w-5" />
        </div>

        <div className="absolute inset-x-3 bottom-3 space-y-1.5 pr-12">
          <div className="flex items-center gap-2">
            <Avatar account={account} size="h-7 w-7" />
            <span className="text-xs font-semibold text-white">{name}</span>
            <span className="rounded border border-white/70 px-1.5 py-px text-[10px] text-white">关注</span>
          </div>
          {caption && (
            <p className="line-clamp-2 whitespace-pre-wrap text-xs text-white drop-shadow">
              <Caption text={caption} linkClass="text-white/90 font-medium" />
            </p>
          )}
          <p className="flex items-center gap-1 text-[10px] text-white/80">
            <Music className="h-3 w-3" />
            原声 · {name}
          </p>
        </div>
      </Frame>
    )
  }

  return (
    <Frame width="w-[380px]">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
          <Avatar account={account} size="h-8 w-8" className="ring-2 ring-white" />
        </span>
        <span className="truncate text-sm font-semibold">{name}</span>
        <MoreHorizontal className="ml-auto h-4 w-4 shrink-0" />
      </div>

      <Media media={media} className="aspect-square" fit="cover" />

      <div className="flex items-center gap-4 px-3 pt-3">
        <Heart className="h-6 w-6" />
        <MessageCircle className="h-6 w-6" />
        <Send className="h-6 w-6" />
        <Bookmark className="ml-auto h-6 w-6" />
      </div>

      <p className="px-3 pt-2 text-sm font-semibold">1,286 次赞</p>
      {caption && (
        <p className="whitespace-pre-wrap px-3 pt-1 text-sm leading-snug">
          <span className="font-semibold">{name}</span>{' '}
          <Caption text={caption} linkClass="text-[#00376b]" />
        </p>
      )}
      <p className="px-3 pb-3 pt-1.5 text-[10px] uppercase text-neutral-400">刚刚</p>
    </Frame>
  )
}

/** 还没接入发布接口的平台，只按版式给个大概，不假装还原它们的界面 */
export function GenericPreview({ content, media }: PreviewProps) {
  const caption = composeCaption(content)
  return (
    <Frame width="w-[380px]">
      <Media media={media} className={isVertical(content.type) ? 'aspect-[9/16]' : 'aspect-video'} fit="cover" />
      <div className="space-y-1 p-3">
        <p className="text-sm font-semibold">{content.title}</p>
        {caption && <p className="whitespace-pre-wrap text-sm text-neutral-600">{caption}</p>}
      </div>
    </Frame>
  )
}

function Frame({ width, className, children }: {
  width: string
  className?: string
  children: React.ReactNode
}) {
  // 平台界面本身是浅色的，这里锁死配色，跟着系统切深色反而不像了
  return (
    <div className={cn('overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-sm', width, className)}>
      {children}
    </div>
  )
}

function Media({ media, className, fit = 'contain' }: {
  media: ContentPreviewMedia | undefined
  className?: string
  fit?: 'cover' | 'contain'
}) {
  const objectFit = fit === 'cover' ? 'object-cover' : 'object-contain'

  if (!media?.mediaUrl) {
    return (
      <div className={cn('flex items-center justify-center bg-neutral-100 text-xs text-neutral-400', className)}>
        没有媒体文件
      </div>
    )
  }

  if (media.mediaKind === 'video') {
    return (
      <video
        src={media.mediaUrl}
        poster={media.coverUrl ?? undefined}
        controls
        playsInline
        className={cn('w-full bg-black', objectFit, className)}
      />
    )
  }

  return (
    <img src={media.mediaUrl} alt="" className={cn('w-full bg-neutral-100', objectFit, className)} />
  )
}

function Avatar({ account, size, className }: { account?: Account; size: string; className?: string }) {
  if (account?.avatar) {
    return <img src={account.avatar} alt="" className={cn('shrink-0 rounded-full object-cover', size, className)} />
  }
  return (
    <span className={cn('shrink-0 rounded-full bg-neutral-300', size, className)} />
  )
}

/** 话题标签在两个平台上都是蓝色可点的，纯黑一片就看不出标签占了多少篇幅 */
function Caption({ text, linkClass }: { text: string; linkClass: string }) {
  return (
    <>
      {text.split(/(#[^\s#]+)/g).map((part, i) =>
        part.startsWith('#')
          ? <span key={i} className={linkClass}>{part}</span>
          : <span key={i}>{part}</span>,
      )}
    </>
  )
}

function FbAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center justify-center gap-1.5 py-1.5">
      {icon}
      {label}
    </span>
  )
}

function IgSideIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      {icon}
      <span className="text-[10px]">{label}</span>
    </span>
  )
}
