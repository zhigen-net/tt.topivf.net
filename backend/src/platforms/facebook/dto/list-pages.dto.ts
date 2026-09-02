import { IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ListPagesDto {
  /** 系统用户令牌或长期用户令牌，只用于换取主页 token，不落库 */
  @ApiProperty()
  @IsString()
  @MinLength(20)
  token: string
}
