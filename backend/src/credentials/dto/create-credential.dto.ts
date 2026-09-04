import { IsString, Length } from 'class-validator'

export class CreateCredentialDto {
  @IsString()
  @Length(1, 64)
  label: string

  @IsString()
  @Length(20, 1000)
  token: string
}

export class RotateTokenDto {
  @IsString()
  @Length(20, 1000)
  token: string
}
