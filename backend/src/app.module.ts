import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { BullModule } from '@nestjs/bullmq'
import { AccountsModule } from './accounts/accounts.module'
import { ContentsModule } from './contents/contents.module'
import { TasksModule } from './tasks/tasks.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { ProxiesModule } from './proxies/proxies.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { PlatformsModule } from './platforms/platforms.module'
import { McpModule } from './mcp/mcp.module'
import appConfig from './config/app.config'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('POSTGRES_HOST'),
        port: cfg.get<number>('POSTGRES_PORT'),
        database: cfg.get('POSTGRES_DB'),
        username: cfg.get('POSTGRES_USER'),
        password: cfg.get('POSTGRES_PASSWORD'),
        autoLoadEntities: true,
        synchronize: cfg.get('NODE_ENV') !== 'production',
        logging: cfg.get('NODE_ENV') === 'development',
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get('REDIS_HOST'),
          port: cfg.get<number>('REDIS_PORT'),
          password: cfg.get('REDIS_PASSWORD'),
        },
      }),
    }),

    PlatformsModule,
    UsersModule,
    AuthModule,
    AccountsModule,
    ContentsModule,
    TasksModule,
    ProxiesModule,
    AnalyticsModule,
    DashboardModule,
    McpModule,
  ],
})
export class AppModule {}
