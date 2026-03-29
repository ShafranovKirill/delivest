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
      // Используем сырой запрос для атомарности (SKIP LOCKED)
      const messages = await this.prisma.$queryRaw<OutboxMessage[]>`
          SELECT * FROM "outbox_messages"
          ORDER BY "created_at" ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
      `;

      if (messages.length === 0) return;

      this.logger.debug(`Found ${messages.length} messages in outbox`);

      for (const msg of messages) {
        try {
          await this.prisma.$transaction(async (tx) => {
            // КРИТИЧНО: Этот промис должен отклониться (reject),
            // если слушатель (SendCodeListener) выбросил ошибку.
            await this.eventBus.publish(msg.type, msg.payload);

            // Если выполнение дошло сюда, значит publish прошел успешно
            await tx.outboxMessage.delete({
              where: { id: msg.id },
            });

            this.logger.log(
              `[Outbox] Message ${msg.id} (${msg.type}) successfully processed and DELETED.`,
            );
          });
        } catch (err) {
          // Если транзакция упала, управление попадает сюда. Запись в БД НЕ удаляется.
          this.logger.error(
            `[Outbox] FAILED message ${msg.id}. Transaction rolled back. Reason: ${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error('Outbox batch selection failed', (err as Error).stack);
    } finally {
      this.isProcessing = false;
    }
  }
}
