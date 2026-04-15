import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { ChildPhotoQueuePayload } from '../interface/photo-payload.interface.js';
import { MediaService } from '../media.service.js';
import sharp from 'sharp';
import * as mime from 'mime-types';
import { ChildResult } from '../interface/photo-editor-result.interface.js';

@Processor('photo-editor')
@Injectable()
export class PhotoEditorProcessor extends WorkerHost {
  private readonly logger = new Logger(PhotoEditorProcessor.name);
  constructor(private readonly mediaService: MediaService) {
    super();
  }

  async process(job: Job<ChildPhotoQueuePayload>) {
    const { originalFileId, profile, profileKey, targetId } = job.data;

    try {
      const fileInfo = await this.mediaService.findOne(originalFileId);
      const s3Stream = await this.mediaService.getFileStream(originalFileId);
      const transformer = sharp();

      if (profile.format) {
        transformer.toFormat(profile.format, {
          quality: profile.quality || 80,
        });
      }

      transformer.resize({
        width: profile.width,
        height: profile.height,
        fit: profile.fit ? sharp.fit[profile.fit] : sharp.fit.contain,
        position: profile.position || 'centre',
        background: profile.background || {
          r: 255,
          g: 255,
          b: 255,
          alpha: 1,
        },
        withoutEnlargement: true,
      });

      const processedStream = s3Stream.pipe(transformer);

      let newOriginalName = fileInfo.originalName;
      let mimeType = fileInfo.mimeType;
      if (profile.format) {
        const detectedMime = mime.lookup(profile.format);
        if (detectedMime) {
          mimeType = detectedMime;
          const extension = mime.extension(mimeType) || profile.format;
          newOriginalName = fileInfo.originalName.replace(
            /\.[^.]+$/,
            `.${extension}`,
          );
        }
      }

      const convertedFile = await this.mediaService.uploadFile(
        {
          body: processedStream,
          originalName: newOriginalName,
          mimeType: mimeType,
        },
        targetId,
      );
      this.logger.log(
        `photoWorker | Success: Photo processed for target[${targetId}] with profile[${profileKey}]. S3 Key: ${convertedFile.key}`,
      );
      const result: ChildResult = {
        key: profileKey,
        fileKey: convertedFile.key,
        success: true,
      };
      return result;
    } catch (editError) {
      this.logger.error(
        `photoWorker | Edit failed for file ${originalFileId}`,
        editError,
      );
      return {
        key: job.data.profileKey,
        fileId: null,
        error: (editError as Error).message,
        success: false,
      };
    }
  }
}
