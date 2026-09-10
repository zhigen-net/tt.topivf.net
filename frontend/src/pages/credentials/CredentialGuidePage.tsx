import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { CredentialGuide, type GuideSectionId } from './CredentialGuide'

/** 独立页面，方便用户把它开在旁边、对照着在 Meta 后台一步步点 */
export default function CredentialGuidePage() {
  const [params] = useSearchParams()
  const focus = (params.get('focus') as GuideSectionId | null) ?? undefined

  return (
    <div className="max-w-3xl space-y-4">
      <Link
        to="/workspace/credentials"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回授权凭证
      </Link>
      <div>
        <h2 className="text-lg font-semibold">Meta 授权凭证接入指引</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          适用于 Facebook 主页与 Instagram 专业账号。整套流程在 Meta 后台完成，本系统只负责保管令牌。
        </p>
      </div>
      <CredentialGuide focus={focus} />
    </div>
  )
}
