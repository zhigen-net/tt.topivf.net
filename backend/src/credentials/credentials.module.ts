import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MetaCredential } from './meta-credential.entity'
import { CredentialsService } from './credentials.service'
import { CredentialsController } from './credentials.controller'
import { CredentialsScheduler } from './credentials.scheduler'
import { Account } from '../accounts/account.entity'

// FacebookService 和 SecretBox 都来自 @Global 模块，不用在这里 import
@Module({
  imports: [TypeOrmModule.forFeature([MetaCredential, Account])],
  controllers: [CredentialsController],
  providers: [CredentialsService, CredentialsScheduler],
  exports: [CredentialsService],
})
export class CredentialsModule {}
