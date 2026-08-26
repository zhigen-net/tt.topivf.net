import { registerAs } from '@nestjs/config'

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.BACKEND_PORT ?? '3000', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
}))
