import { Injectable, Logger } from '@nestjs/common';
import { IOrderStatusStrategy } from '../interfaces/order-status.strategy.interface.js';
import {
  Order,
  OrderStatus,
  PrismaClient,
} from '../../../../generated/prisma/client.js';
import { IdentityService } from '../../../identify/identify.service.js';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { TransactionHost } from '@nestjs-cls/transactional';

@Injectable()
export class ProcessingStrategy implements IOrderStatusStrategy {
  private readonly logger = new Logger(ProcessingStrategy.name);

  readonly status = OrderStatus.PROCESSING;

  constructor(
    private readonly identifyService: IdentityService,
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
  ) {}

  async execute(order: Order): Promise<void> {
    this.logger.log(
      `[OrderService] Processing strategy triggered for Order ID: ${order.id}`,
    );
    if (order.phone && !order.clientId) {
      const client = await this.identifyService.createProfileIfNotExist({
        phone: order.phone,
      });

      if (client.id) {
        await this.txHost.tx.order.update({
          where: { id: order.id },
          data: { clientId: client.id },
        });
      }
    }
  }
}
