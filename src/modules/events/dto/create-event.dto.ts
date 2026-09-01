import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsISO8601()
  eventDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  durationHours?: number;

  @IsOptional()
  @IsIn(['public', 'pin'])
  privacy?: 'public' | 'pin';

  @ValidateIf((dto: CreateEventDto) => dto.privacy === 'pin')
  @IsString()
  @Length(4, 12)
  pin?: string;

  @IsOptional()
  @IsBoolean()
  revealMode?: boolean;

  @ValidateIf((dto: CreateEventDto) => Boolean(dto.revealMode))
  @IsISO8601()
  revealAt?: string;

  @IsOptional()
  @IsBoolean()
  allowDownloads?: boolean;

  @IsOptional()
  @IsBoolean()
  allowVideos?: boolean;

  @IsOptional()
  @IsBoolean()
  allowVoice?: boolean;

  @IsOptional()
  @IsBoolean()
  challengesOn?: boolean;

  @IsOptional()
  @IsBoolean()
  bestOfOn?: boolean;

  @IsOptional()
  @IsBoolean()
  disposableOn?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(150)
  photosPerGuest?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  maxPhotos?: number;
}
