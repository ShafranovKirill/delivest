import {
  DeliveryType,
  Order,
  OrderStatus,
} from '../../../../generated/prisma/client.js';

export interface IOrderStatusStrategy {
  readonly status: OrderStatus;

  readonly deliveryType?: DeliveryType;

  execute(order: Order): Promise<void>;
}
