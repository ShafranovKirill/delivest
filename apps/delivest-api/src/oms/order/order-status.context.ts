import { Injectable, Logger } from '@nestjs/common';

import { IOrderStatusStrategy } from './interfaces/order-status.strategy.interface.js';
import { DeliveryType, OrderStatus } from '../../../generated/prisma/enums.js';
import { Order } from '../../../generated/prisma/client.js';

@Injectable()
export class OrderStatusContext {
  private readonly logger = new Logger(OrderStatusContext.name);

  private readonly strategies = new Map<string, IOrderStatusStrategy>();

  constructor(private readonly allStrategies: IOrderStatusStrategy[]) {
    this.registerStrategies();
  }

  private registerStrategies() {
    this.allStrategies.forEach((strategy) => {
      const key = this.getStrategyKey(strategy.status, strategy.deliveryType);
      this.strategies.set(key, strategy);

      this.logger.log(`Registered strategy: ${key}`);
    });
  }

  private getStrategyKey(status: OrderStatus, type?: DeliveryType): string {
    return type ? `${status}_${type}` : status;
  }

  async execute(order: Order) {
    let strategy = this.strategies.get(
      this.getStrategyKey(order.status, order.deliveryType),
    );

    if (!strategy) {
      strategy = this.strategies.get(order.status);
    }

    if (strategy) {
      this.logger.debug(
        `[OrderStatusContext] Executing strategy for status ${order.status}`,
      );
      await strategy.execute(order);
    } else {
      this.logger.warn(
        `[OrderStatusContext] No strategy found for status: ${order.status}`,
      );
    }
  }
}
