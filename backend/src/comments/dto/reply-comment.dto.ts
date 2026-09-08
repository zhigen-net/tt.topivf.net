import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ReplyCommentDto {
  /** Facebook 评论上限 8000 字符，Instagram 2200，取宽的那个，具体由平台再拒一次 */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  message: string
}

export class IgnoreCommentDto {
  @ApiProperty()
  @IsBoolean()
  ignored: boolean
}
