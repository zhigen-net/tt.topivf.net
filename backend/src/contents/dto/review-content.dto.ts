import { IsIn, IsString, MaxLength, ValidateIf } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { BulkIdsDto } from './bulk-contents.dto'

export const REVIEW_STATUSES = ['draft', 'pending', 'approved', 'rejected'] as const

export const REVIEW_ACTIONS = ['approve', 'reject'] as const
export type ReviewAction = (typeof REVIEW_ACTIONS)[number]

export class ReviewContentDto {
  @ApiProperty({ enum: REVIEW_ACTIONS })
  @IsIn(REVIEW_ACTIONS)
  action: ReviewAction

  @ApiPropertyOptional({ description: '驳回时必填' })
  @ValidateIf((o: ReviewContentDto) => o.action === 'reject')
  @IsString()
  @MaxLength(500)
  note?: string
}

export class BulkReviewDto extends BulkIdsDto {
  @ApiProperty({ enum: REVIEW_ACTIONS })
  @IsIn(REVIEW_ACTIONS)
  action: ReviewAction

  @ApiPropertyOptional()
  @ValidateIf((o: BulkReviewDto) => o.action === 'reject')
  @IsString()
  @MaxLength(500)
  note?: string
}
