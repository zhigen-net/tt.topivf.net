import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Account } from './account.entity'
import { AccountsController } from './accounts.controller'
import { AccountsService } from './accounts.service'
import { Proxy } from '../proxies/proxy.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Account, Proxy])],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
