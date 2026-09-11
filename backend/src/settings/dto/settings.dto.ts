import { IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateSettingsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  siteName: string
}
