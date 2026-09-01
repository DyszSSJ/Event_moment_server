import type { Event, Photo } from '@prisma/client';

type EventWithCounts = Event & {
  _count?: {
    participants: number;
    photos: number;
  };
  photos?: Array<
    Pick<
      Photo,
      'id' | 'url' | 'thumbnailUrl' | 'mimeType' | 'status' | 'uploadedAt'
    > & {
      participant?: {
        displayName: string;
      } | null;
    }
  >;
};

export function mapEvent(event: EventWithCounts) {
  const revealMode = Boolean(event.revealAt);
  const durationHours = event.uploadClosesAt
    ? Math.max(
        1,
        Math.round(
          (event.uploadClosesAt.getTime() - event.createdAt.getTime()) /
            (1000 * 60 * 60),
        ),
      )
    : null;

  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    description: event.description,
    coverUrl: event.coverUrl,
    eventDate: event.eventDate?.toISOString() ?? null,
    uploadClosesAt: event.uploadClosesAt?.toISOString() ?? null,
    durationHours,
    revealMode,
    revealAt: event.revealAt?.toISOString() ?? null,
    status: event.status.toLowerCase(),
    privacy: event.privacy === 'PIN_PROTECTED' ? 'pin' : 'public',
    allowDownloads: event.allowDownloads,
    maxPhotos: event.maxPhotos,
    views: event.views,
    contributors: event._count?.participants ?? 0,
    photosCount: event._count?.photos ?? 0,
    photos:
      event.photos?.map((photo) => ({
        id: photo.id,
        url: photo.url,
        thumbnailUrl: photo.thumbnailUrl,
        mimeType: photo.mimeType,
        status: photo.status.toLowerCase(),
        uploadedAt: photo.uploadedAt.toISOString(),
        guest: photo.participant?.displayName ?? 'Invitado',
      })) ?? undefined,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
