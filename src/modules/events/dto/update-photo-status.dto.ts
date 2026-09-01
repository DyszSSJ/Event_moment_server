import { IsIn } from 'class-validator';

export class UpdatePhotoStatusDto {
  @IsIn(['pending', 'approved', 'rejected'])
  status!: 'pending' | 'approved' | 'rejected';
}
