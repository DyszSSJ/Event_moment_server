import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';

import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { ClerkAuthGuard } from '../../common/guards/clerk-auth.guard';
import { UpdatePhotoStatusDto } from './dto/update-photo-status.dto';
import { UploadEventPhotosDto } from './dto/upload-event-photos.dto';
import { PhotosService, type UploadedPhotoFile } from './photos.service';

@Controller('events')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post(':slug/photos')
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      limits: {
        fileSize: 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        if (file.mimetype.startsWith('image/')) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
    }),
  )
  uploadPhotos(
    @Param('slug') slug: string,
    @Body() dto: UploadEventPhotosDto,
    @UploadedFiles() files: UploadedPhotoFile[],
    @Req() request: Request,
  ) {
    return this.photosService.uploadPhotos(
      slug,
      dto,
      files,
      this.getPublicOrigin(request),
      this.getClientIp(request),
    );
  }

  @Get(':slug/photos/download')
  @UseGuards(ClerkAuthGuard)
  async downloadPhotos(
    @CurrentUserId() clerkId: string,
    @Param('slug') slug: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const download = await this.photosService.downloadApprovedPhotos(
      clerkId,
      slug,
    );

    response.setHeader('Content-Type', 'application/zip');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${download.fileName}"`,
    );
    response.setHeader('Content-Length', download.data.length.toString());

    return new StreamableFile(download.data);
  }

  @Get(':slug/photos/:photoId/file')
  async getPhotoFile(
    @Param('slug') slug: string,
    @Param('photoId') photoId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const photo = await this.photosService.getPhotoFile(slug, photoId);

    response.setHeader('Content-Type', photo.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    return new StreamableFile(Buffer.from(photo.data));
  }

  @Patch(':id/photos/:photoId/status')
  @UseGuards(ClerkAuthGuard)
  updatePhotoStatus(
    @CurrentUserId() clerkId: string,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Body() dto: UpdatePhotoStatusDto,
  ) {
    return this.photosService.updatePhotoStatus(
      clerkId,
      id,
      photoId,
      dto.status,
    );
  }

  @Delete(':id/photos/:photoId')
  @UseGuards(ClerkAuthGuard)
  removePhoto(
    @CurrentUserId() clerkId: string,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.photosService.removePhoto(clerkId, id, photoId);
  }

  private getPublicOrigin(request: Request) {
    return `${request.protocol}://${request.get('host')}`;
  }

  private getClientIp(request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim() || request.ip || 'unknown';
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
