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

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsISO8601()
  eventDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  durationHours?: number;

  @IsOptional()
  @IsIn(['draft', 'active', 'closed', 'frozen'])
  status?: 'draft' | 'active' | 'closed' | 'frozen';

  @IsOptional()
  @IsIn(['public', 'pin'])
  privacy?: 'public' | 'pin';

  @ValidateIf((dto: UpdateEventDto) => dto.privacy === 'pin')
  @IsString()
  @Length(4, 12)
  pin?: string;

  @IsOptional()
  @IsBoolean()
  revealMode?: boolean;

  @ValidateIf((dto: UpdateEventDto) => Boolean(dto.revealMode))
  @IsISO8601()
  revealAt?: string | null;

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
  maxPhotos?: number | null;
}
