import { Module } from '@nestjs/common';
import { ClientService } from './client.service.js';
import { ClientController } from './client.controller.js';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminClientController } from './admin-client.controller.js';
import { OutboxModule } from '../../outbox/outbox.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { NotificationModule } from '../../notification/notification.module.js';

@Module({
  imports: [
    OutboxModule,
    JwtModule,
    PrismaModule,
    ConfigModule,
    NotificationModule,
  ],
  controllers: [ClientController, AdminClientController],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
