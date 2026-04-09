import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PhotoJobData } from '../interface/photo-job-data.interface.js';
import { PhotoEditResult } from '../interface/photo-editor-result.interface.js';

@Injectable()
export class PhotoQueueService {
  private readonly logger = new Logger(PhotoQueueService.name);

  constructor(
    @InjectQueue('photo-editor')
    private readonly photoEditorQueue: Queue<PhotoJobData, PhotoEditResult>,
  ) {}

  async sendToPhotoEditor(data: PhotoJobData) {
    await this.photoEditorQueue.add('photo-editor', {
      fileId: data.fileId,
      userId: data.userId,
      access: data.access,
      profile: data.profile,
      socketId: data.socketId,
    });
  }
}
