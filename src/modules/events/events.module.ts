import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [AuthModule],
  controllers: [EventsController, PhotosController],
  providers: [EventsService, PhotosService],
  exports: [EventsService, PhotosService],
})
export class EventsModule {}
