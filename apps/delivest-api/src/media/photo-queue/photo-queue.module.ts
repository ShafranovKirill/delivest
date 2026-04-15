import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PhotoEditorProcessor } from './photo-editor.processor.js';
import { MediaModule } from '../media.module.js';
import { PhotoEditorService } from './photo-editor.service.js';
import { MediaCleanupJob } from '../workers/media-cleanup.job.js';
import { FlowProducer } from 'bullmq';
import { PhotoFinishProcessor } from './photo-finish.processor.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MediaModule,
    BullModule.registerQueueAsync(
      {
        name: 'photo-editor',
        useFactory: (config: ConfigService) => ({
          name: config.getOrThrow('PHOTO_EDITOR_QUEUE_NAME'),
        }),
        inject: [ConfigService],
      },
      {
        name: 'photo-notifications',
      },
    ),
  ],
  providers: [
    PhotoEditorProcessor,
    PhotoEditorService,
    MediaCleanupJob,
    PhotoFinishProcessor,
    {
      provide: 'PHOTO_FLOW_PRODUCER',
      useFactory: (config: ConfigService) => {
        return new FlowProducer({
          connection: {
            host: config.getOrThrow('REDIS_HOST'),
            port: config.getOrThrow('REDIS_PORT'),
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [BullModule, PhotoEditorService, 'PHOTO_FLOW_PRODUCER'],
})
export class PhotoQueueModule {}
