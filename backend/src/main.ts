import { NestFactory, Reflector } from '@nestjs/core'
import { ClassSerializerInterceptor, ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

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
