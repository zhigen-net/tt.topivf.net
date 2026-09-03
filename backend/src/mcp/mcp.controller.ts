import { Controller, Delete, Get, Post, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiExcludeController } from '@nestjs/swagger'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Response } from 'express'
import { McpService } from './mcp.service'
import type { AuthRequest } from '../auth/auth-request'

// 这里不能声明任何 DTO 参数：全局 ValidationPipe 会先啃一遍 JSON-RPC 报文。
// 同理用 @Res() 直接写响应，绕开 ClassSerializerInterceptor。
@ApiBearerAuth()
@ApiExcludeController()
@Controller('mcp')
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Post()
  async handle(@Req() req: AuthRequest, @Res() res: Response) {
    if (!req.apiKey || !req.user) {
      res.status(403).json(rpcError('MCP 端点只接受 API Key（sh_ 开头）认证'))
      return
    }

    // 签发人被移出空间、降为只读或空间被删，密钥立刻失去意义
    if (!req.workspace || req.workspace.role === 'viewer') {
      res.status(403).json(rpcError('该密钥的工作空间已失效，或签发人已无权在该空间操作'))
      return
    }

    const server = this.mcp.build({ key: req.apiKey, user: req.user, ws: req.workspace })
    // 无状态模式：每个请求一套 server/transport，客户端不需要维持会话
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })

    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  }

  @Get()
  getNotAllowed(@Res() res: Response) {
    notAllowed(res)
  }

  @Delete()
  deleteNotAllowed(@Res() res: Response) {
    notAllowed(res)
  }
}

function notAllowed(res: Response) {
  res.status(405).json(rpcError('无状态 MCP 端点只支持 POST'))
}

function rpcError(message: string) {
  return { jsonrpc: '2.0', error: { code: -32000, message }, id: null }
}
