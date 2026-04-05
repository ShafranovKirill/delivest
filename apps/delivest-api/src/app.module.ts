import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { NetModule } from './net/net.module.js';
import { IdentityModule } from './identify/identify.module.js';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaService } from './prisma/prisma.service.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { SharedModule } from './shared/shared.module.js';
import { NotificationModule } from './notification/notification.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    PrismaModule,
    EventEmitterModule.forRoot(),
    NetModule,
    IdentityModule,
    OutboxModule,
    SharedModule,
    NotificationModule,
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          imports: [PrismaModule],
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: PrismaService,
            sqlFlavor: 'postgresql',
          }),
        }),
      ],
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
