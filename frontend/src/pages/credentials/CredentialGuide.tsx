import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { CredentialErrorCode } from '@/types'

export type GuideSectionId =
  | 'choose'
  | 'system-user'
  | 'graph-explorer'
  | 'own-app'
  | 'scopes'
  | 'assets'
  | 'instagram'
  | 'troubleshoot'

/**
 * 报错码 → 教程小节。用户看到红字时最需要的是「那我现在该点哪」，
 * 而不是再通读一遍全文。没有对应小节的码不进这张表，前端就不显示跳转。
 */
export const SECTION_FOR_CODE: Partial<Record<CredentialErrorCode, GuideSectionId>> = {
  PAGE_TOKEN: 'system-user',
  SHORT_LIVED: 'graph-explorer',
  MISSING_SCOPES: 'scopes',
  NO_PAGES: 'assets',
  TOKEN_INVALID: 'system-user',
  GRAPH_ERROR: 'troubleshoot',
}

interface Section {
  id: GuideSectionId
  title: string
  body: ReactNode
}

const SECTIONS: Section[] = [
  {
    id: 'choose',
    title: '先选一种拿令牌的方式',
    body: (
      <>
        <p>
          本系统托管的是<strong>用户级令牌</strong>（系统用户令牌或长期用户令牌），不是主页令牌。
          主页令牌由本系统在接入时自动换取，你不需要自己去拿。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>方式 A · 系统用户令牌</strong>：永不过期，一次配好长期不用管。
            要求你是商务管理平台（Business Manager）的管理员。<strong>推荐所有正式使用走这条。</strong>
          </li>
          <li>
            <strong>方式 B · 图形 API 工具取用户令牌</strong>：最快，5 分钟能跑通，但只有 60 天，
            到期要重新走一遍。适合先试通流程。
          </li>
          <li>
            <strong>方式 C · 自建应用的长期用户令牌</strong>：同样 60 天，且因为令牌来自你自己的应用，
            本系统<strong>不会</strong>帮你自动续期。
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'system-user',
    title: '方式 A：商务管理平台系统用户令牌（推荐，永不过期）',
    body: (
      <>
        <Steps>
          <li>
            打开 <Path>business.facebook.com</Path>，右下角
            <Path>商务设置（Business settings）</Path>。没有商务管理平台的先建一个。
          </li>
          <li>
            左侧 <Path>账户 → 主页</Path>，把要发布的主页<strong>添加进这个商务管理平台</strong>。
            主页不在这里，后面无论怎么勾权限都读不到它。
          </li>
          <li>
            左侧 <Path>账户 → 应用</Path>，添加或新建一个应用。没有应用的话去
            <Path>developers.facebook.com/apps</Path> 建一个，用途选「商家（Business）」。
          </li>
          <li>
            左侧 <Path>用户 → 系统用户</Path>，点<Path>添加</Path>，起个名字，
            角色选<strong>管理员系统用户</strong>。
          </li>
          <li>
            <strong>这一步最容易漏</strong>：选中刚建的系统用户，点<Path>分配资产</Path>，
            分别把<strong>主页</strong>和<strong>应用</strong>都分配给它。
            主页的权限里要开<strong>「管理主页」或「创建内容」</strong>。
            漏了这步，令牌本身有效，但名下一个主页都读不到。
          </li>
          <li>
            点<Path>生成新令牌</Path>，选中刚才那个应用，勾选权限（见下方「需要哪些权限」），
            有效期选<strong>永不过期</strong>，生成后<strong>立刻复制</strong>——弹窗关掉就再也看不到了。
          </li>
        </Steps>
        <Note>
          令牌以 <code>EAA</code> 开头，很长（几百个字符）。粘贴时注意不要漏字符或带上换行。
        </Note>
      </>
    ),
  },
  {
    id: 'graph-explorer',
    title: '方式 B：图形 API 工具取令牌，再延长到 60 天',
    body: (
      <>
        <Steps>
          <li>
            打开 <Path>developers.facebook.com/tools/explorer</Path>（图形 API 探索工具）。
          </li>
          <li>
            右上角 <Path>Meta 应用</Path> 选你的应用；<Path>用户或页面</Path>选
            <strong>用户令牌（User Token）</strong>，<strong>不要</strong>选具体某个主页。
          </li>
          <li>
            在下方权限清单里勾上所需权限（见下方「需要哪些权限」），点
            <Path>生成访问令牌</Path>，按提示登录授权。
          </li>
          <li>
            <strong>这时拿到的是 1~2 小时就失效的短期令牌，不能直接用。</strong>
            点令牌输入框右侧的蓝色感叹号图标 → <Path>打开访问令牌调试工具</Path>。
          </li>
          <li>
            在调试工具页面底部点<Path>延长访问令牌（Extend Access Token）</Path>，
            重新登录后会生成一条新的令牌，有效期约 60 天。<strong>复制这条新的</strong>，
            不是上一步那条。
          </li>
        </Steps>
        <Note>
          60 天后令牌会失效，届时到「授权凭证」页面用<strong>更换令牌</strong>重新粘一条即可，
          已接入的账号不用重新绑定。
        </Note>
      </>
    ),
  },
  {
    id: 'own-app',
    title: '方式 C：自建 Meta 应用的长期用户令牌',
    body: (
      <>
        <p>
          如果你已经用自己的应用换出了长期用户令牌，直接粘进来也能用。但要知道两件事：
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>本系统只能续期由<strong>本系统所配置的应用</strong>签发的令牌，你自己应用签发的续不了。</li>
          <li>因此这条令牌到期时不会自动延长，需要你手动更换。</li>
        </ul>
        <Note>
          如果你粘的是自己应用签发的<strong>短期</strong>令牌，系统会直接拒绝——
          因为由它换出的主页凭证一小时后就会失效，且当场看不出任何异常。请先按方式 B 第 5 步延长。
        </Note>
      </>
    ),
  },
  {
    id: 'scopes',
    title: '需要哪些权限',
    body: (
      <>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code>pages_show_list</code> — <strong>必需</strong>，用来列出你名下的主页。
          </li>
          <li>
            <code>pages_manage_posts</code> — <strong>必需</strong>，用来发布和删除帖子。
          </li>
          <li>
            <code>pages_read_engagement</code> — 建议开。用来读粉丝数、评论和视频转码状态。
            不开也能发布，但这些数据会缺。
          </li>
          <li>
            <code>instagram_basic</code>、<code>instagram_content_publish</code> —
            要接入 Instagram 才需要。
          </li>
          <li>
            <code>pages_manage_engagement</code> — 要用本系统回复评论才需要。
          </li>
        </ul>
        <Note>
          应用后台列出的权限只是「可申请」，令牌上实际带了哪些是另一回事。
          用下方的<strong>令牌预检</strong>可以直接看到这条令牌真正带上的权限清单。
        </Note>
      </>
    ),
  },
  {
    id: 'assets',
    title: '提示「名下没有可发布的主页」怎么办',
    body: (
      <>
        <p>
          令牌是好的，但它看不到任何有发布权限的主页。按顺序排查：
        </p>
        <Steps>
          <li>
            主页是否已加入商务管理平台：<Path>商务设置 → 账户 → 主页</Path>，确认主页在列表里。
          </li>
          <li>
            系统用户是否被分配了这个主页：<Path>商务设置 → 用户 → 系统用户</Path>，
            选中它 → <Path>分配资产</Path> → 主页，确认该主页被勾上，且权限含
            <strong>「创建内容」</strong>。
          </li>
          <li>
            你自己在这个主页上是不是管理员或编辑。只是「版主」「广告主」是发不了帖的。
          </li>
          <li>
            令牌是否勾了 <code>pages_show_list</code>。没勾的话列表一定是空的。
          </li>
        </Steps>
      </>
    ),
  },
  {
    id: 'instagram',
    title: 'Instagram 的额外条件',
    body: (
      <>
        <p>Instagram 账号不能单独接入，必须挂在一个 Facebook 主页下。三个条件缺一不可：</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            该 Instagram 是<strong>专业账号</strong>（商家或创作者），个人号不行。
            在 Instagram App 里 <Path>设置 → 账户类型和工具 → 切换为专业账号</Path>。
          </li>
          <li>
            该 Instagram 已<strong>关联到对应的 Facebook 主页</strong>。
            在主页的 <Path>设置 → 已关联的账户 → Instagram</Path> 里绑定。
          </li>
          <li>令牌带了 <code>instagram_basic</code> 权限。</li>
        </ul>
        <Note>
          三者齐了之后，接入主页时系统会自动把它下面的 Instagram 一起列出来，不用另外加凭证。
        </Note>
      </>
    ),
  },
  {
    id: 'troubleshoot',
    title: '其他常见报错',
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>「这是一条主页令牌」</strong>：你在图形 API 工具里把「用户或页面」选成了某个主页。
          改选<strong>用户令牌</strong>重新生成。
        </li>
        <li>
          <strong>「令牌无效或已被吊销」</strong>：改过 Facebook 密码、退出过全部设备、
          或在应用后台点过「重置密钥」，都会让旧令牌立刻失效。重新生成一条即可。
        </li>
        <li>
          <strong>「接口限流」</strong>：短时间请求太多。等几分钟再试，不用改任何配置。
        </li>
        <li>
          <strong>「未配置 CREDENTIAL_ENCRYPTION_KEY」</strong>：这是服务端配置问题，
          不是你的令牌有问题。请联系系统管理员。
        </li>
      </ul>
    ),
  },
]

/**
 * 教程正文。弹窗内和独立页面共用同一份，避免两处说法漂移。
 * focus 传进来时把对应小节滚到视野里并高亮，让报错能直接落到具体步骤上。
 */
export function CredentialGuide({ focus }: { focus?: GuideSectionId }) {
  const focusRef = useRef<HTMLElement>(null)

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focus])

  return (
    <div className="space-y-5">
      {SECTIONS.map((s) => {
        const active = s.id === focus
        return (
          <section
            key={s.id}
            id={`guide-${s.id}`}
            ref={active ? focusRef : undefined}
            className={cn(
              'scroll-mt-4 rounded-md text-sm',
              active && 'bg-primary/5 ring-1 ring-primary/30 p-3 -m-0.5',
            )}
          >
            <h3 className="font-medium">{s.title}</h3>
            <div className="mt-2 space-y-2 text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_strong]:text-foreground">
              {s.body}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>
}

/** 菜单路径。没有截图，路径就是用户唯一的导航依据，得跟正文区分开 */
function Path({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">「{children}」</span>
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-muted/60 px-3 py-2 text-xs">{children}</p>
}
