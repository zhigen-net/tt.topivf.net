import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { graphGet, GraphError } from './graph-api'

export interface LinkablePage {
  pageId: string
  name: string
  avatar?: string
  followers: number
  accessToken: string
}

interface AccountsEdge {
  data: Array<{
    id: string
    name: string
    access_token?: string
    followers_count?: number
    fan_count?: number
    picture?: { data?: { url?: string } }
    tasks?: string[]
  }>
}

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name)

  async listPages(token: string): Promise<LinkablePage[]> {
    let res: AccountsEdge
    try {
      res = await graphGet<AccountsEdge>(
        '/me/accounts',
        { fields: 'id,name,access_token,followers_count,fan_count,picture,tasks', limit: '100' },
        token,
      )
    } catch (err) {
      if (err instanceof GraphError && err.isAuthError) {
        throw new BadRequestException('令牌无效或已被吊销，请到商务管理平台重新生成')
      }
      if (err instanceof GraphError && err.isRateLimit) {
        throw new BadRequestException('Facebook 接口限流，请稍后再试')
      }
      throw new BadRequestException(`无法读取主页列表: ${err instanceof Error ? err.message : err}`)
    }

    const pages = (res.data ?? [])
      .filter((p) => p.access_token && p.tasks?.includes('CREATE_CONTENT'))
      .map((p) => ({
        pageId: p.id,
        name: p.name,
        avatar: p.picture?.data?.url,
        followers: p.followers_count ?? p.fan_count ?? 0,
        accessToken: p.access_token as string,
      }))

    this.logger.log(`Listed ${pages.length} linkable Facebook page(s)`)
    if (!pages.length) {
      throw new BadRequestException('该令牌名下没有可发布的主页，请确认已分配主页资产与发布权限')
    }
    return pages
  }
}
