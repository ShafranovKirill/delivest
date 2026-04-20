import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { NetModule } from '../../net/net.module.js';
import { MediaModule } from '../../media/media.module.js';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';
import { OrderStatusContext } from './order-status.context.js';
import { ProcessingStrategy } from './strategies/processing.strategy.js';
import { IOrderStatusStrategy } from './interfaces/order-status.strategy.interface.js';
import { CartModule } from '../cart/cart.module.js';
import { IdentityModule } from '../../identify/identify.module.js';
const STRATEGIES = [ProcessingStrategy];
@Module({
  imports: [
    PrismaModule,
    CartModule,
    NetModule,
    JwtModule,
    MediaModule,
    ConfigModule,
    IdentityModule,
  ],
  providers: [
    OrderService,
    ...STRATEGIES,
    {
      provide: OrderStatusContext,
      useFactory: (...strategies: IOrderStatusStrategy[]) => {
        return new OrderStatusContext(strategies);
      },
      inject: STRATEGIES,
    },
  ],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
