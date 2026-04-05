import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Prisma, PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class OutboxService {
  constructor(
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
  ) {}

  async save(type: string, payload: Prisma.InputJsonValue): Promise<void> {
    await this.txHost.tx.outboxMessage.create({
      data: {
        type,
        payload,
      },
    });
  }
}
