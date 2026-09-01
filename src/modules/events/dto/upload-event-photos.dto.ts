import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class UploadEventPhotosDto {
  @IsString()
  @Length(1, 80)
  displayName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(4, 12)
  pin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  challengeId?: string;
}
