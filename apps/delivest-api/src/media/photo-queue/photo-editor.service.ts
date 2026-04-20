import { Inject, Injectable, Logger } from '@nestjs/common';
import { FlowJob, FlowProducer } from 'bullmq';
import {
  ChildPhotoQueuePayload,
  ParentPhotoQueuePayload,
} from '../interface/photo-payload.interface.js';
import { MediaService } from '../media.service.js';
import { FileUploadFailedException } from '../../shared/exceptions/domain_exception/domain-exception.js';
import { UploadFile } from '../interface/upload-file.interface.js';
import { PhotoProfile } from '../photo-configs/profiles.js';
import { PhotoKey } from '@delivest/common';
import { DelivestEvent } from '../../shared/events/types.js';

@Injectable()
export class PhotoEditorService {
  private readonly logger = new Logger(PhotoEditorService.name);

  constructor(
    @Inject('PHOTO_FLOW_PRODUCER')
    private readonly flow: FlowProducer,
    private readonly mediaService: MediaService,
  ) {}

  async uploadAndEditMultiple(
    targetId: string,
    file: UploadFile,
    configs: { profile: PhotoProfile; key: PhotoKey }[],
    socketId: string,
    eventType: DelivestEvent,
    failEventType: DelivestEvent,
  ): Promise<void> {
    try {
      const savedFile = await this.mediaService.uploadFile(file, targetId);

      const flowJob: FlowJob = {
        name: 'photo-finish-hub',
        queueName: 'photo-notifications',
        data: {
          targetId,
          socketId,
          originalFileKey: savedFile.key,
          succesEventType: eventType,
          failEventType: failEventType,
        } satisfies ParentPhotoQueuePayload,
        children: configs.map((config) => ({
          name: 'photo-editor',
          queueName: 'photo-editor',
          data: {
            originalFileId: savedFile.id,
            profile: config.profile,
            profileKey: config.key,
            targetId: targetId,
          } satisfies ChildPhotoQueuePayload,
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
          },
        })),
      };

      await this.flow.add(flowJob);

      this.logger.log(
        `Flow created for ${targetId}. Children only get fileId and profile.`,
      );
    } catch (error) {
      this.logger.error(
        `uploadAndEditMultiple() | Failed: ${(error as Error).message}`,
      );
      throw new FileUploadFailedException();
    }
  }
}
