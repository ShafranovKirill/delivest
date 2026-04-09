import { Module } from '@nestjs/common';
import { OmsService } from './oms.service.js';
import { CartModule } from './cart/cart.module.js';
@Module({
  imports: [CartModule],
  providers: [OmsService],
  exports: [],
})
export class OmsModule {}
