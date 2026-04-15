import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { NetModule } from '../../net/net.module.js';
import { MediaModule } from '../../media/media.module.js';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';
@Module({
  imports: [PrismaModule, NetModule, JwtModule, MediaModule, ConfigModule],
  providers: [OrderService],
  controllers: [OrderController],
  exports: [],
})
export class OrderModule {}
