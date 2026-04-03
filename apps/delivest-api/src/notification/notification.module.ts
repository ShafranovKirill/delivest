import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { OutboxModule } from '../outbox/outbox.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SendCodeListener } from './listeners/send-code.listener.js';
import { UCallerSmsAdapter } from './adapters/ucaller/ucaller.adapter.js';
import { isProd } from '../utils/env.js';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { DevelopSmsAdapter } from './adapters/ucaller/develop.adapter.js';
import { AuthCleanupJob } from './workers/auth-cleanup.job.js';

@Module({
  imports: [OutboxModule, PrismaModule, HttpModule],
  controllers: [],
  providers: [
    NotificationService,
    SendCodeListener,
    DevelopSmsAdapter,
    UCallerSmsAdapter,
    ConfigModule,
    AuthCleanupJob,
    {
      provide: 'IAuthCodeSenderUCaller',
      inject: [DevelopSmsAdapter, UCallerSmsAdapter],
      useFactory: (dev: DevelopSmsAdapter, uCaller: UCallerSmsAdapter) => {
        const provider = isProd() ? uCaller : dev;
        return provider;
      },
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
