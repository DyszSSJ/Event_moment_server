import { IsString, Length } from 'class-validator';

export class UnlockEventPinDto {
  @IsString()
  @Length(4, 12)
  pin!: string;
}
