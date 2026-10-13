import { IsIn, IsOptional } from 'class-validator';

export class BulkUpdatePhotoStatusDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  fromStatus?: 'pending' | 'approved' | 'rejected';

  @IsIn(['pending', 'approved', 'rejected'])
  status!: 'pending' | 'approved' | 'rejected';
}
