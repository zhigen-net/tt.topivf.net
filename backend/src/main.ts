import { NestFactory, Reflector } from '@nestjs/core'
import { ClassSerializerInterceptor, ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'
import { ASSET_INLINE_MAX_SIZE } from './assets/assets.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false })

  // MCP 只能把素材塞进 JSON 参数里，这条路的报文天生比别处大一个量级，
  // base64 还要再涨三分之一。单独给它放宽，其余路由维持小上限。
  app.use('/v1/mcp', json({ limit: Math.ceil(ASSET_INLINE_MAX_SIZE * 1.4) }))
  app.use(json({ limit: '1mb' }))
  app.use(urlencoded({ extended: true, limit: '1mb' }))

  app.enableCors({ origin: true, credentials: true })

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  )

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  const doc = new DocumentBuilder()
    .setTitle('SocialHub API')
    .setDescription('Social media account management platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc))

  const port = process.env.BACKEND_PORT ?? 3000
  await app.listen(port, '0.0.0.0')
  console.log(`API running on http://0.0.0.0:${port}`)
}

bootstrap()
