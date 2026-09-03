import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { ApiKey } from './api-key.entity'
import { ApiKeysController } from './api-keys.controller'
import { ApiKeysService } from './api-keys.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { RolesGuard } from './roles.guard'
import { UsersModule } from '../users/users.module'
import { Account } from '../accounts/account.entity'

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([ApiKey, Account]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get('JWT_SECRET'),
        signOptions: { expiresIn: cfg.get('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [AuthController, ApiKeysController],
  providers: [
    AuthService,
    ApiKeysService,
    // 顺序即执行顺序：先认证拿到 req.user，RolesGuard 才有东西可判
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, ApiKeysService, JwtModule],
})
export class AuthModule {}
