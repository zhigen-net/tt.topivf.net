import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ description: '登录邮箱' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(255)
  email: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string
}
