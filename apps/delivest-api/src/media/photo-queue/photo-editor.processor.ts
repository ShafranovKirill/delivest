import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { PhotoJobData } from '../interface/photo-job-data.interface.js';
import { PhotoConvertedEvent, PhotoEvent } from '../../shared/events/types.js';
import { MediaService } from '../media.service.js';
import sharp from 'sharp';
import type { Sharp } from 'sharp';

@Processor('photo-editor')
@Injectable()
export class PhotoEditorProcessor extends WorkerHost {
  private readonly logger = new Logger(PhotoEditorProcessor.name);
  private readonly EXTENSION_MAP: Record<string, string> = {
    jpeg: 'jpg',
    png: 'png',
    webp: 'webp',
    heif: 'heif',
    gif: 'gif',
    tiff: 'tiff',
    avif: 'avif',
  };

  private readonly MIME_MAP: Record<string, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heif: 'image/heif',
    gif: 'image/gif',
    tiff: 'image/tiff',
    avif: 'image/avif',
  };

  constructor(
    private eventEmitter: EventEmitter2,
    private readonly mediaService: MediaService,
  ) {
    super();
  }

  async process(job: Job<PhotoJobData>): Promise<void> {
    const { fileId, profile, socketId } = job.data;
    try {
      const originalBuffer = await this.mediaService.getFileBuffer(fileId);
      const fileInfo = await this.mediaService.findOne(fileId);

      let processor: Sharp = sharp(originalBuffer);

      if (profile.format) {
        processor = processor.toFormat(profile.format);
        this.logger.log(
          `photoWorker | Photo ${fileId} convert to ${profile.format}`,
        );
      }

      if (profile.width || profile.height) {
        processor = processor.resize(profile.width, profile.height, {
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        });
        this.logger.log(
          `photoWorker | Photo ${fileId} resize to width:${profile.width}, height:${profile.height}`,
        );
      }

      const processedBuffer = await processor.toBuffer();

      let newOriginalName = fileInfo.originalName;
      let mimeType = fileInfo.mimeType;

      if (profile.format) {
        const extension = this.EXTENSION_MAP[profile.format];
        mimeType = this.MIME_MAP[profile.format];
        newOriginalName = fileInfo.originalName.replace(
          /\.[^.]+$/,
          `.${extension}`,
        );
      }
      const uploadFile = {
        buffer: processedBuffer,
        originalName: newOriginalName,
        mimeType: mimeType,
        size: processedBuffer.length,
      };

      const convertedFile = await this.mediaService.uploadFile(uploadFile);

      const resultData: PhotoConvertedEvent = {
        originalFileId: fileId,
        newFileId: convertedFile.id,
        socketId: socketId,
      };

      await this.eventEmitter.emitAsync(PhotoEvent.PHOTO_CONVERTED, resultData);
    } catch (editError) {
      this.logger.error(`photoWorker | Edit is failed ${editError}`);
    }
  }
}
