import { Controller, UseGuards } from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger/dist/decorators/index.js';
import { OptionalJwtClientAuthGuard } from '../../identify/client/guards/jwt-client-optional.guard.js';
import { OrderService } from './order.service.js';

@ApiTags('Order (Заказ)')
@UseGuards(OptionalJwtClientAuthGuard)
@ApiBearerAuth('client-auth')
@ApiHeader({
  name: 'Cookie',
  description: 'Может содержать session_id для неавторизованных пользователей',
  required: false,
})
@Controller('order')
export class OrderController {
  constructor(private readonly cartService: OrderService) {}
}
