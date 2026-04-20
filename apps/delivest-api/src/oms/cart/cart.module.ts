import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { CartService } from './cart.service.js';
import { CartController } from './cart.controller.js';
import { NetModule } from '../../net/net.module.js';
import { RedisModule } from '../../redis/redis.module.js';
import { MediaModule } from '../../media/media.module.js';
import { ConfigModule } from '@nestjs/config';
import { AdminCartController } from './admin-cart.controller.js';
import { JwtModule } from '@nestjs/jwt';
@Module({
  imports: [
    PrismaModule,
    NetModule,
    RedisModule,
    JwtModule,
    MediaModule,
    ConfigModule,
  ],
  providers: [CartService],
  controllers: [CartController, AdminCartController],
  exports: [CartService],
})
export class CartModule {}
