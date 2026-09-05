import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { PostsService } from './posts.service'
import { QueryPostsDto } from './dto/query-posts.dto'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from '../workspaces/workspace-context'

@ApiTags('posts')
@ApiBearerAuth()
@MinWorkspaceRole('viewer')
@Controller('posts')
export class PostsController {
  constructor(private readonly svc: PostsService) {}

  // 必须排在任何 ':id' 路由前面，否则 summary 会被当成 id
  @Get('summary')
  summary(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.summary(ws.id)
  }

  @Get()
  findAll(@Query() query: QueryPostsDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findAll(ws.id, query)
  }
}
