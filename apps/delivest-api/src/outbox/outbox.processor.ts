/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { type IEventBus } from '@delivest/common';
import { OutboxMessage } from '../../generated/prisma/client.js';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  private isProcessing = false;

  constructor(
    @Inject('IEventBus')
    private readonly eventBus: IEventBus,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleOutboxMessages() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.prisma.$transaction(async (tx) => {
        const messages = await tx.$queryRaw<OutboxMessage[]>`
          SELECT * FROM "outbox_messages"
          ORDER BY "created_at" ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        `;

        if (messages.length === 0) return;

        this.logger.log(`Processing ${messages.length} outbox messages...`);

        for (const msg of messages) {
          try {
            await this.eventBus.publish(msg.type, msg.payload);

            await tx.outboxMessage.delete({
              where: { id: msg.id },
            });
          } catch (err) {
            this.logger.error(
              `Failed to process message ${msg.id}: ${(err as Error).message}`,
            );
            throw err;
          }
        }
      });
    } catch (err) {
      this.logger.error('Outbox processing batch failed', (err as Error).stack);
    } finally {
      this.isProcessing = false;
    }
  }
}
