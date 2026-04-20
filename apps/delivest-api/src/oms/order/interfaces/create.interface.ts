import { CreateOrderRequest } from '@delivest/types';
import { OrderStatus } from '../../../../generated/prisma/enums.js';

export interface ICreateOrderInternal extends CreateOrderRequest {
  status: OrderStatus;
}
