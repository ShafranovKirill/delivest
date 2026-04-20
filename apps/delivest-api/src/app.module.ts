import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { SessionMiddleware } from './shared/middleware/session.middleware.js';
import { RedisModule } from './redis/redis.module.js';
import { OmsModule } from './oms/oms.module.js';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    PrismaModule,
    EventEmitterModule.forRoot(),
    NetModule,
    OmsModule,
    IdentityModule,
    OutboxModule,
    SharedModule,
    NotificationModule,
    RedisModule,
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
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (conf: ConfigService) => ({
        connection: {
          host: conf.getOrThrow('REDIS_HOST'),
          port: conf.getOrThrow('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
