import { IsString, MaxLength, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  username: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string
}
