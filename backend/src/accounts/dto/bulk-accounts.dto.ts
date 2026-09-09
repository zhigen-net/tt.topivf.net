import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsUUID } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { ACCOUNT_STATUSES, type AccountStatus } from '../account.entity'

export class BulkAccountIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids: string[]
}

export class BulkAccountStatusDto extends BulkAccountIdsDto {
  @ApiProperty({ enum: ACCOUNT_STATUSES })
  @IsEnum(ACCOUNT_STATUSES)
  status: AccountStatus
}
