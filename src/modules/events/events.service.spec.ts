import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventPrivacy, EventStatus } from '@prisma/client';

import { AuthService } from '../auth/auth.service';
import { EventsService } from './events.service';

describe('EventsService', () => {
  const eventDate = new Date('2026-09-01T00:00:00.000Z');
  const now = new Date('2026-08-28T00:00:00.000Z');
  const event = {
    id: 'event_1',
    ownerId: 'user_1',
    name: 'Boda Ana & Luis',
    slug: 'boda-ana-luis-abcd',
    description: null,
    coverUrl: null,
    eventDate,
    uploadClosesAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
    revealAt: null,
    status: EventStatus.ACTIVE,
    privacy: EventPrivacy.PUBLIC,
    pinHash: null,
    allowDownloads: true,
    maxPhotos: null,
    views: 0,
    createdAt: now,
    updatedAt: now,
    _count: {
      participants: 0,
      photos: 0,
    },
  };
  const prisma = {
    event: {
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const authService = {
    syncCurrentUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authService.syncCurrentUser.mockResolvedValue({
      id: 'user_1',
      clerkId: 'clerk_1',
    });
    prisma.event.findFirst.mockResolvedValue(null);
    prisma.event.findUnique.mockResolvedValue(null);
  });

  it('creates an event owned by the current user', async () => {
    jest.useFakeTimers().setSystemTime(now);
    prisma.event.create.mockResolvedValue(event);
    const service = new EventsService(
      prisma as never,
      authService as unknown as AuthService,
    );

    await expect(
      service.create('clerk_1', {
        name: 'Boda Ana & Luis',
        eventDate: eventDate.toISOString(),
        durationHours: 72,
        privacy: 'public',
      }),
    ).resolves.toMatchObject({
      id: 'event_1',
      slug: 'boda-ana-luis-abcd',
      privacy: 'public',
      status: 'active',
      contributors: 0,
      photosCount: 0,
    });

    expect(authService.syncCurrentUser).toHaveBeenCalledWith('clerk_1');
    expect(prisma.event.create).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('rejects admin access when the event belongs to another user', async () => {
    prisma.event.findFirst.mockResolvedValue({
      ...event,
      ownerId: 'other_user',
    });
    const service = new EventsService(
      prisma as never,
      authService as unknown as AuthService,
    );

    await expect(
      service.findAdmin('clerk_1', 'event_1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unlocks an event when the pin matches', async () => {
    const service = new EventsService(
      prisma as never,
      authService as unknown as AuthService,
    );
    prisma.event.findUnique.mockResolvedValue({
      ...event,
      privacy: EventPrivacy.PIN_PROTECTED,
      pinHash:
        '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    });

    await expect(
      service.unlockPin('boda-ana-luis-abcd', '1234'),
    ).resolves.toEqual({
      unlocked: true,
    });
  });

  it('throws not found for missing public event', async () => {
    const service = new EventsService(
      prisma as never,
      authService as unknown as AuthService,
    );

    await expect(service.findPublic('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
