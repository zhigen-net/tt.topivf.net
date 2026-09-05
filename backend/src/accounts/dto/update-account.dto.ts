import { IsEnum, IsOptional } from 'class-validator'
import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger'
import { CreateAccountDto } from './create-account.dto'
import { ACCOUNT_STATUSES, type AccountStatus } from '../account.entity'

// platform 决定了用哪个适配器、凭证怎么解释，建号后改它只会让账号和凭证对不上
export class UpdateAccountDto extends PartialType(OmitType(CreateAccountDto, ['platform'] as const)) {
  @ApiPropertyOptional({ enum: ACCOUNT_STATUSES })
  @IsOptional()
  @IsEnum(ACCOUNT_STATUSES)
  status?: AccountStatus
}

export class UpdateStatusDto {
  @ApiPropertyOptional({ enum: ACCOUNT_STATUSES })
  @IsEnum(ACCOUNT_STATUSES)
  status: AccountStatus
}
