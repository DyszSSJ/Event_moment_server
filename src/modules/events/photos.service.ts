import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventPrivacy, EventStatus, PhotoStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadEventPhotosDto } from './dto/upload-event-photos.dto';

export type UploadedPhotoFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async uploadPhotos(
    slug: string,
    dto: UploadEventPhotosDto,
    files: UploadedPhotoFile[],
    origin: string,
  ) {
    if (!files.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'NO_FILES_UPLOADED',
        message: 'At least one file is required',
      });
    }

    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            photos: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }

    this.assertCanUpload(event, dto.pin, files.length);

    const participant = await this.prisma.participant.upsert({
      where: {
        eventId_guestKey: {
          eventId: event.id,
          guestKey: this.createGuestKey(dto.displayName, dto.email),
        },
      },
      create: {
        eventId: event.id,
        displayName: dto.displayName.trim(),
        email: dto.email?.trim() || null,
        guestKey: this.createGuestKey(dto.displayName, dto.email),
      },
      update: {
        displayName: dto.displayName.trim(),
        email: dto.email?.trim() || null,
      },
    });

    const photos = await this.prisma.$transaction(
      files.map((file) =>
        this.prisma.photo.create({
          data: {
            eventId: event.id,
            participantId: participant.id,
            storageKey: `db:${randomBytes(10).toString('hex')}`,
            url: '',
            thumbnailUrl: null,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            data: new Uint8Array(file.buffer),
            status: PhotoStatus.PENDING,
          },
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
        }),
      ),
    );

    return Promise.all(
      photos.map((photo) =>
        this.prisma.photo
          .update({
            where: { id: photo.id },
            data: {
              url: `${origin}/api/v1/events/${slug}/photos/${photo.id}/file`,
            },
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
          })
          .then((updatedPhoto) => ({
            id: updatedPhoto.id,
            url: updatedPhoto.url,
            thumbnailUrl: updatedPhoto.thumbnailUrl,
            mimeType: updatedPhoto.mimeType,
            status: updatedPhoto.status.toLowerCase(),
            uploadedAt: updatedPhoto.uploadedAt.toISOString(),
            guest: updatedPhoto.participant?.displayName ?? dto.displayName,
          })),
      ),
    );
  }

  async getPhotoFile(slug: string, photoId: string) {
    const photo = await this.prisma.photo.findFirst({
      where: {
        id: photoId,
        event: { slug },
      },
      select: {
        data: true,
        mimeType: true,
      },
    });

    if (!photo?.data) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'PHOTO_NOT_FOUND',
        message: 'Photo not found',
      });
    }

    return {
      data: photo.data,
      mimeType: photo.mimeType,
    };
  }

  async downloadApprovedPhotos(slug: string, pin?: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: {
        name: true,
        slug: true,
        privacy: true,
        pinHash: true,
        allowDownloads: true,
        photos: {
          where: {
            status: PhotoStatus.APPROVED,
            data: { not: null },
          },
          orderBy: { uploadedAt: 'asc' },
          select: {
            id: true,
            data: true,
            mimeType: true,
            uploadedAt: true,
            participant: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }

    if (!event.allowDownloads) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EVENT_DOWNLOADS_DISABLED',
        message: 'Event downloads are disabled',
      });
    }

    if (
      event.privacy === EventPrivacy.PIN_PROTECTED &&
      event.pinHash !== this.hashPin(pin ?? '')
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'INVALID_EVENT_PIN',
        message: 'Invalid event PIN',
      });
    }

    if (!event.photos.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'NO_APPROVED_PHOTOS',
        message: 'There are no approved photos to download',
      });
    }

    const files = event.photos.map((photo, index) => ({
      name: this.createDownloadFileName(
        event.slug,
        photo.participant?.displayName,
        photo.mimeType,
        index + 1,
      ),
      data: Buffer.from(photo.data ?? []),
    }));

    return {
      fileName: `${this.slugify(event.name)}-recuerdos.zip`,
      data: this.createZip(files),
    };
  }

  async listPublicPhotos(slug: string) {
    const photos = await this.prisma.photo.findMany({
      where: {
        event: { slug },
        status: PhotoStatus.APPROVED,
      },
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
    });

    return photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl,
      mimeType: photo.mimeType,
      status: photo.status.toLowerCase(),
      uploadedAt: photo.uploadedAt.toISOString(),
      guest: photo.participant?.displayName ?? 'Invitado',
    }));
  }

  async updatePhotoStatus(
    clerkId: string,
    idOrSlug: string,
    photoId: string,
    status: 'pending' | 'approved' | 'rejected',
  ) {
    const event = await this.findOwnedEvent(clerkId, idOrSlug);
    const existingPhoto = await this.prisma.photo.findFirst({
      where: {
        id: photoId,
        eventId: event.id,
      },
      select: { id: true },
    });

    if (!existingPhoto) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'PHOTO_NOT_FOUND',
        message: 'Photo not found',
      });
    }

    const photo = await this.prisma.photo.update({
      where: { id: existingPhoto.id },
      data: {
        status: this.toPhotoStatus(status),
      },
      select: {
        id: true,
        status: true,
      },
    });

    return {
      id: photo.id,
      status: photo.status.toLowerCase(),
    };
  }

  async removePhoto(clerkId: string, idOrSlug: string, photoId: string) {
    const event = await this.findOwnedEvent(clerkId, idOrSlug);
    const photo = await this.prisma.photo.findFirst({
      where: {
        id: photoId,
        eventId: event.id,
      },
      select: { id: true },
    });

    if (!photo) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'PHOTO_NOT_FOUND',
        message: 'Photo not found',
      });
    }

    await this.prisma.photo.delete({ where: { id: photo.id } });

    return { deleted: true };
  }

  private assertCanUpload(
    event: {
      status: EventStatus;
      privacy: EventPrivacy;
      pinHash: string | null;
      uploadClosesAt: Date | null;
      maxPhotos: number | null;
      _count: { photos: number };
    },
    pin: string | undefined,
    filesCount: number,
  ) {
    if (
      event.status === EventStatus.CLOSED ||
      event.status === EventStatus.FROZEN
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EVENT_CLOSED',
        message: 'Event is closed',
      });
    }

    if (event.uploadClosesAt && event.uploadClosesAt.getTime() < Date.now()) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EVENT_UPLOAD_CLOSED',
        message: 'Event upload window is closed',
      });
    }

    if (
      event.privacy === EventPrivacy.PIN_PROTECTED &&
      event.pinHash !== this.hashPin(pin ?? '')
    ) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'INVALID_EVENT_PIN',
        message: 'Invalid event PIN',
      });
    }

    if (event.maxPhotos && event._count.photos + filesCount > event.maxPhotos) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EVENT_PHOTO_LIMIT_REACHED',
        message: 'Event photo limit reached',
      });
    }
  }

  private async findOwnedEvent(clerkId: string, idOrSlug: string) {
    const owner = await this.authService.syncCurrentUser(clerkId);
    const event = await this.prisma.event.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      select: {
        id: true,
        ownerId: true,
      },
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

  private createGuestKey(displayName: string, email?: string) {
    const value = `${displayName.trim().toLowerCase()}:${email?.trim().toLowerCase() ?? ''}`;

    return createHash('sha1').update(value).digest('hex');
  }

  private hashPin(pin: string) {
    return createHash('sha256').update(pin).digest('hex');
  }

  private toPhotoStatus(status: 'pending' | 'approved' | 'rejected') {
    const statusMap = {
      pending: PhotoStatus.PENDING,
      approved: PhotoStatus.APPROVED,
      rejected: PhotoStatus.REJECTED,
    } satisfies Record<typeof status, PhotoStatus>;

    return statusMap[status];
  }

  private createDownloadFileName(
    slug: string,
    guest: string | undefined,
    mimeType: string,
    index: number,
  ) {
    const guestSlug = this.slugify(guest ?? 'invitado');
    const extension = this.getFileExtension(mimeType);

    return `${slug}/${String(index).padStart(3, '0')}-${guestSlug}.${extension}`;
  }

  private getFileExtension(mimeType: string) {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/heic': 'heic',
      'image/heif': 'heif',
    };

    return extensionMap[mimeType] ?? 'jpg';
  }

  private createZip(files: Array<{ name: string; data: Buffer }>) {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    for (const file of files) {
      const name = Buffer.from(file.name, 'utf8');
      const crc = this.crc32(file.data);
      const localHeader = Buffer.alloc(30);

      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0x0800, 6);
      localHeader.writeUInt16LE(0, 8);
      localHeader.writeUInt16LE(0, 10);
      localHeader.writeUInt16LE(0, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(file.data.length, 18);
      localHeader.writeUInt32LE(file.data.length, 22);
      localHeader.writeUInt16LE(name.length, 26);
      localHeader.writeUInt16LE(0, 28);

      localParts.push(localHeader, name, file.data);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8);
      centralHeader.writeUInt16LE(0, 10);
      centralHeader.writeUInt16LE(0, 12);
      centralHeader.writeUInt16LE(0, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(file.data.length, 20);
      centralHeader.writeUInt32LE(file.data.length, 24);
      centralHeader.writeUInt16LE(name.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);

      centralParts.push(centralHeader, name);
      offset += localHeader.length + name.length + file.data.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const endHeader = Buffer.alloc(22);

    endHeader.writeUInt32LE(0x06054b50, 0);
    endHeader.writeUInt16LE(0, 4);
    endHeader.writeUInt16LE(0, 6);
    endHeader.writeUInt16LE(files.length, 8);
    endHeader.writeUInt16LE(files.length, 10);
    endHeader.writeUInt32LE(centralDirectory.length, 12);
    endHeader.writeUInt32LE(offset, 16);
    endHeader.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, endHeader]);
  }

  private crc32(data: Buffer) {
    let crc = 0xffffffff;

    for (const byte of data) {
      crc ^= byte;

      for (let bit = 0; bit < 8; bit += 1) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  private slugify(value: string) {
    return (
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'archivo'
    );
  }
}
