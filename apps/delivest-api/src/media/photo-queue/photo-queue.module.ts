import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PhotoEditorProcessor } from './photo-editor.processor.js';
import { MediaModule } from '../media.module.js';
import { PhotoEditorService } from './photo-editor.service.js';
import { MediaCleanupJob } from '../workers/media-cleanup.job.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MediaModule,
    BullModule.registerQueueAsync({
      name: 'photo-editor',
      useFactory: (config: ConfigService) => ({
        name: config.getOrThrow('PHOTO_EDITOR_QUEUE_NAME'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [PhotoEditorProcessor, PhotoEditorService, MediaCleanupJob],
  exports: [BullModule, PhotoEditorService],
})
export class PhotoQueueModule {}
