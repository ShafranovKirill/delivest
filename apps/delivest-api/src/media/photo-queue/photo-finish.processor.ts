import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ParentPhotoQueuePayload } from '../interface/photo-payload.interface.js';
import { ChildResult } from '../interface/photo-editor-result.interface.js';
import { Logger } from '@nestjs/common/services/index.js';
import { PHOTO_KEYS } from '@delivest/common';
import { PhotoConversionEvent, PhotoMap } from '../../shared/events/types.js';

@Processor('photo-notifications')
export class PhotoFinishProcessor extends WorkerHost {
  private readonly logger = new Logger(PhotoFinishProcessor.name);

  constructor(private eventEmitter: EventEmitter2) {
    super();
  }

  async process(job: Job<ParentPhotoQueuePayload>) {
    const {
      targetId,
      socketId,
      originalFileKey,
      succesEventType,
      failEventType,
    } = job.data;

    const childrenValues = await job.getChildrenValues<ChildResult>();
    const photosBatch: PhotoMap = {
      [PHOTO_KEYS.PRODUCT_ORIGINAL]: originalFileKey,
    };

    const totalChildren = Object.keys(childrenValues).length + 1;

    for (const res of Object.values(childrenValues)) {
      if (res && res.success && res.fileKey) {
        photosBatch[res.key] = res.fileKey;
      }
    }

    const successfulCount = Object.keys(photosBatch).length;

    const isFullySuccessful =
      successfulCount === totalChildren && totalChildren > 0;

    const resultPayload: PhotoConversionEvent = {
      targetId,
      socketId,
      photos: photosBatch,
    };

    if (isFullySuccessful) {
      this.logger.log(
        `[PhotoFinishProcessor] Flow SUCCESS for target[${targetId}]. All ${successfulCount} photos processed.`,
      );

      this.eventEmitter.emit(succesEventType, resultPayload);
      return { status: 'success' };
    } else {
      const errorMessage = `Partial failure: processed ${successfulCount} out of ${totalChildren} photos`;

      this.logger.error(
        `[PhotoFinishProcessor] Flow FAILED for target[${targetId}]. ${errorMessage}`,
      );

      this.eventEmitter.emit(failEventType, {
        targetId,
        socketId,
        message: errorMessage,
        partialPhotos: photosBatch,
      });

      return { status: 'failed', reason: errorMessage };
    }
  }
}
