import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayNotEmpty, IsIn, IsString, Length, ValidateNested } from 'class-validator'

export class LinkTargetDto {
  @IsIn(['facebook', 'instagram'])
  platform: 'facebook' | 'instagram'

  /** facebook 是 pageId，instagram 是 igUserId */
  @IsString()
  @Length(1, 64)
  externalId: string
}

export class LinkTargetsDto {
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LinkTargetDto)
  targets: LinkTargetDto[]
}
