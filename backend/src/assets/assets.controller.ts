import {
  BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Post, Query, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { ASSET_MAX_SIZE, AssetsService } from './assets.service'
import { QueryAssetsDto } from './dto/asset.dto'
import { Public } from '../auth/public.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import type { User } from '../users/user.entity'
import { CurrentWorkspace, MinWorkspaceRole, type WorkspaceContext } from '../workspaces/workspace-context'

// 角色标在每个方法上而不是类上：raw 是公开签名路由，不能被类级的空间要求罩住
@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly svc: AssetsService) {}

  @Get()
  @MinWorkspaceRole('viewer')
  findAll(@Query() query: QueryAssetsDto, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findAll(ws, query)
  }

  @Post()
  @MinWorkspaceRole('member')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ASSET_MAX_SIZE } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentWorkspace() ws: WorkspaceContext,
    @CurrentUser() actor: User,
  ) {
    if (!file) throw new BadRequestException('请选择要上传的文件')
    return this.svc.upload(file, ws, actor)
  }

  @Get(':id')
  @MinWorkspaceRole('viewer')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.findOneView(id, ws)
  }

  @Delete(':id')
  @MinWorkspaceRole('member')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() ws: WorkspaceContext) {
    return this.svc.remove(id, ws)
  }

  // <img src> / <video src> 带不了 Authorization 头，所以这条路靠短时签名放行
  @Public()
  @Get(':id/raw')
  async raw(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('t') token: string,
    @Res() res: Response,
  ) {
    const { asset, stream } = await this.svc.openSigned(id, token ?? '')
    res.setHeader('Content-Type', asset.mimeType)
    res.setHeader('Cache-Control', 'private, max-age=600')
    stream.pipe(res)
  }
}
