import { Module } from '@nestjs/common';
import { OmsService } from './oms.service.js';
import { CartModule } from './cart/cart.module.js';
import { OrderModule } from './order/order.module.js';
@Module({
  imports: [CartModule, OrderModule],
  providers: [OmsService],
  exports: [],
})
export class OmsModule {}
