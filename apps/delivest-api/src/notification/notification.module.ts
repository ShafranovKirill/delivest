import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { OutboxModule } from '../outbox/outbox.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SendCodeListener } from './listeners/send-code.listener.js';
import { TelegramSmsAdapter } from './adapters/sms/telegram.adapter.js';
import { UCallerSmsAdapter } from './adapters/sms/ucaller.adapter.js';
import { isProd } from '../utils/env.js';

@Module({
  imports: [OutboxModule, PrismaModule],
  controllers: [],
  providers: [
    NotificationService,
    SendCodeListener,
    TelegramSmsAdapter,
    UCallerSmsAdapter,
    {
      provide: 'IAuthCodeSender',
      inject: [TelegramSmsAdapter, UCallerSmsAdapter],
      useFactory: (tg: TelegramSmsAdapter, uCaller: UCallerSmsAdapter) => {
        const provider = isProd() ? uCaller : tg;
        return provider;
      },
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
