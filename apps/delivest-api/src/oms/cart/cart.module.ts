import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { CartService } from './cart.service.js';
import { CartController } from './cart.controller.js';
import { NetModule } from '../../net/net.module.js';
import { RedisModule } from '../../redis/redis.module.js';
@Module({
  imports: [PrismaModule, NetModule, RedisModule],
  providers: [CartService],
  controllers: [CartController],
  exports: [],
})
export class CartModule {}
