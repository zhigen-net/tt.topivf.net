import { IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  /** 字段名保持不变，值可以是用户名也可以是邮箱 */
  @ApiProperty({ description: '用户名或邮箱' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  username: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string
}
