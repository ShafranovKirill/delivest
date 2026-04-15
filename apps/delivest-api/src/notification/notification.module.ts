import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { OutboxModule } from '../outbox/outbox.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SendCodeListener } from './listeners/send-code.listener.js';
import { ZvonokAuthAdapter } from './adapters/zvonok.adapter.js';
import { isProd } from '../utils/env.js';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { DevelopSmsAdapter } from './adapters/develop.adapter.js';
import { AuthCleanupJob } from './workers/auth-cleanup.job.js';
import { NotificationGateway } from './notification.gateway.js';

@Module({
  imports: [OutboxModule, PrismaModule, HttpModule],
  controllers: [],
  providers: [
    NotificationService,
    SendCodeListener,
    DevelopSmsAdapter,
    ZvonokAuthAdapter,
    ConfigModule,
    AuthCleanupJob,
    NotificationGateway,
    {
      provide: 'IAuthCodeSender',
      inject: [DevelopSmsAdapter, ZvonokAuthAdapter],
      useFactory: (dev: DevelopSmsAdapter, Zvonok: ZvonokAuthAdapter) => {
        const provider = isProd() ? Zvonok : dev;
        return provider;
      },
    },
  ],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
