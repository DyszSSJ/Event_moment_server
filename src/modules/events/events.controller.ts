import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UnlockEventPinDto } from './dto/unlock-event-pin.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(ClerkAuthGuard)
  create(@CurrentUserId() clerkId: string, @Body() dto: CreateEventDto) {
    return this.eventsService.create(clerkId, dto);
  }

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  findMine(@CurrentUserId() clerkId: string) {
    return this.eventsService.findMine(clerkId);
  }

  @Get(':id/admin')
  @UseGuards(ClerkAuthGuard)
  findAdmin(@CurrentUserId() clerkId: string, @Param('id') id: string) {
    return this.eventsService.findAdmin(clerkId, id);
  }

  @Patch(':id')
  @UseGuards(ClerkAuthGuard)
  update(
    @CurrentUserId() clerkId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(clerkId, id, dto);
  }

  @Delete(':id')
  @UseGuards(ClerkAuthGuard)
  remove(@CurrentUserId() clerkId: string, @Param('id') id: string) {
    return this.eventsService.remove(clerkId, id);
  }

  @Get(':slug')
  findPublic(@Param('slug') slug: string) {
    return this.eventsService.findPublic(slug);
  }

  @Post(':slug/unlock-pin')
  unlockPin(@Param('slug') slug: string, @Body() dto: UnlockEventPinDto) {
    return this.eventsService.unlockPin(slug, dto.pin);
  }

  @Post(':slug/view')
  recordView(@Param('slug') slug: string) {
    return this.eventsService.recordView(slug);
  }
}
