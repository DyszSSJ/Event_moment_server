import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventPrivacy, EventStatus, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { mapEvent } from './events.mapper';

const eventInclude = {
  _count: {
    select: {
      participants: true,
      photos: true,
    },
  },
} satisfies Prisma.EventInclude;

const eventWithPhotosInclude = {
  ...eventInclude,
  photos: {
    where: { status: 'APPROVED' },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      mimeType: true,
      status: true,
      uploadedAt: true,
      participant: {
        select: {
          displayName: true,
        },
      },
    },
  },
} satisfies Prisma.EventInclude;

const adminEventWithPhotosInclude = {
  ...eventInclude,
  photos: {
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      mimeType: true,
      status: true,
      uploadedAt: true,
      participant: {
        select: {
          displayName: true,
        },
      },
    },
  },
} satisfies Prisma.EventInclude;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async create(clerkId: string, dto: CreateEventDto) {
    const owner = await this.authService.syncCurrentUser(clerkId);
    const now = new Date();
    const durationHours = dto.durationHours ?? 72;
    const event = await this.prisma.event.create({
      data: {
        ownerId: owner.id,
        name: dto.name.trim(),
        slug: await this.createUniqueSlug(dto.name),
        description: this.nullableTrim(dto.description),
        coverUrl: this.nullableTrim(dto.coverUrl),
        eventDate: dto.eventDate ? new Date(dto.eventDate) : null,
        uploadClosesAt: new Date(
          now.getTime() + durationHours * 60 * 60 * 1000,
        ),
        revealAt:
          dto.revealMode && dto.revealAt ? new Date(dto.revealAt) : null,
        status: EventStatus.ACTIVE,
        privacy:
          dto.privacy === 'pin'
            ? EventPrivacy.PIN_PROTECTED
            : EventPrivacy.PUBLIC,
        pinHash:
          dto.privacy === 'pin' && dto.pin ? this.hashPin(dto.pin) : null,
        allowDownloads: dto.allowDownloads ?? true,
        allowVideos: dto.allowVideos ?? true,
        allowVoice: dto.allowVoice ?? false,
        challengesOn: dto.challengesOn ?? false,
        bestOfOn: dto.bestOfOn ?? false,
        disposableOn: dto.disposableOn ?? false,
        photosPerGuest: dto.photosPerGuest ?? 12,
        maxPhotos: dto.maxPhotos ?? 150,
      },
      include: eventInclude,
    });

    return mapEvent(event);
  }

  async findMine(clerkId: string) {
    const owner = await this.authService.syncCurrentUser(clerkId);
    const events = await this.prisma.event.findMany({
      where: { ownerId: owner.id },
      orderBy: { createdAt: 'desc' },
      include: eventInclude,
    });

    return events.map(mapEvent);
  }

  async findPublic(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: eventWithPhotosInclude,
    });

    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }

    return mapEvent(event);
  }

  async findAdmin(clerkId: string, idOrSlug: string) {
    const ownedEvent = await this.findOwnedEvent(clerkId, idOrSlug);
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: ownedEvent.id },
      include: adminEventWithPhotosInclude,
    });

    return mapEvent(event);
  }

  async update(clerkId: string, idOrSlug: string, dto: UpdateEventDto) {
    const currentEvent = await this.findOwnedEvent(clerkId, idOrSlug);

    const event = await this.prisma.event.update({
      where: { id: currentEvent.id },
      data: this.toUpdateData(dto),
      include: adminEventWithPhotosInclude,
    });

    return mapEvent(event);
  }

  async remove(clerkId: string, idOrSlug: string) {
    const event = await this.findOwnedEvent(clerkId, idOrSlug);
    await this.prisma.event.delete({ where: { id: event.id } });

    return { deleted: true };
  }

  async unlockPin(slug: string, pin: string) {
    const event = await this.prisma.event.findUnique({ where: { slug } });

    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }

    if (event.privacy !== EventPrivacy.PIN_PROTECTED || !event.pinHash) {
      return { unlocked: true };
    }

    if (event.pinHash !== this.hashPin(pin)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'INVALID_EVENT_PIN',
        message: 'Invalid event PIN',
      });
    }

    return { unlocked: true };
  }

  async recordView(slug: string) {
    const existing = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }

    const event = await this.prisma.event.update({
      where: { slug },
      data: { views: { increment: 1 } },
      include: eventWithPhotosInclude,
    });

    return mapEvent(event);
  }

  private async findOwnedEvent(clerkId: string, idOrSlug: string) {
    const owner = await this.authService.syncCurrentUser(clerkId);
    const event = await this.prisma.event.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: eventInclude,
    });

    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }

    if (event.ownerId !== owner.id) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EVENT_FORBIDDEN',
        message: 'You do not have access to this event',
      });
    }

    return event;
  }

  private toUpdateData(dto: UpdateEventDto): Prisma.EventUpdateInput {
    const data: Prisma.EventUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      data.description =
        dto.description === null ? null : this.nullableTrim(dto.description);
    }

    if (dto.coverUrl !== undefined) {
      data.coverUrl =
        dto.coverUrl === null ? null : this.nullableTrim(dto.coverUrl);
    }

    if (dto.eventDate !== undefined) {
      data.eventDate = dto.eventDate ? new Date(dto.eventDate) : null;
    }

    if (dto.durationHours !== undefined) {
      data.uploadClosesAt = new Date(
        Date.now() + dto.durationHours * 60 * 60 * 1000,
      );
    }

    if (dto.status !== undefined) {
      data.status = this.toEventStatus(dto.status);
    }

    if (dto.privacy !== undefined) {
      data.privacy =
        dto.privacy === 'pin'
          ? EventPrivacy.PIN_PROTECTED
          : EventPrivacy.PUBLIC;
      data.pinHash =
        dto.privacy === 'pin' && dto.pin ? this.hashPin(dto.pin) : null;
    }

    if (dto.revealMode !== undefined) {
      data.revealAt =
        dto.revealMode && dto.revealAt ? new Date(dto.revealAt) : null;
    } else if (dto.revealAt !== undefined) {
      data.revealAt = dto.revealAt ? new Date(dto.revealAt) : null;
    }

    if (dto.allowDownloads !== undefined) {
      data.allowDownloads = dto.allowDownloads;
    }

    if (dto.allowVideos !== undefined) {
      data.allowVideos = dto.allowVideos;
    }

    if (dto.allowVoice !== undefined) {
      data.allowVoice = dto.allowVoice;
    }

    if (dto.challengesOn !== undefined) {
      data.challengesOn = dto.challengesOn;
    }

    if (dto.bestOfOn !== undefined) {
      data.bestOfOn = dto.bestOfOn;
    }

    if (dto.disposableOn !== undefined) {
      data.disposableOn = dto.disposableOn;
    }

    if (dto.photosPerGuest !== undefined) {
      data.photosPerGuest = dto.photosPerGuest;
    }

    if (dto.maxPhotos !== undefined) {
      data.maxPhotos = dto.maxPhotos;
    }

    return data;
  }

  private async createUniqueSlug(name: string) {
    const baseSlug = this.slugify(name);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug =
        attempt === 0
          ? `${baseSlug}-${randomBytes(2).toString('hex')}`
          : `${baseSlug}-${randomBytes(3).toString('hex')}`;
      const existing = await this.prisma.event.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }
    }

    return `${baseSlug}-${randomBytes(6).toString('hex')}`;
  }

  private slugify(value: string) {
    return (
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'evento'
    );
  }

  private hashPin(pin: string) {
    return createHash('sha256').update(pin).digest('hex');
  }

  private nullableTrim(value?: string | null) {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
  }

  private toEventStatus(status: NonNullable<UpdateEventDto['status']>) {
    const statusMap = {
      draft: EventStatus.DRAFT,
      active: EventStatus.ACTIVE,
      closed: EventStatus.CLOSED,
      frozen: EventStatus.FROZEN,
    } satisfies Record<NonNullable<UpdateEventDto['status']>, EventStatus>;

    return statusMap[status];
  }
}
