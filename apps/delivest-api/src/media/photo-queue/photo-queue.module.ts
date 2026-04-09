import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PhotoEditorProcessor } from './photo-editor.processor.js';
import { PhotoQueueService } from './photo-queue.service.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    FilesModule,
    BullModule.registerQueueAsync({
      name: 'photo-editor',
      useFactory: (config: ConfigService) => ({
        name: config.getOrThrow('PHOTO_EDITOR_QUEUE_NAME'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [PhotoEditorProcessor, PhotoQueueService],
  exports: [BullModule, PhotoQueueService],
})
export class PhotoQueueModule {}
