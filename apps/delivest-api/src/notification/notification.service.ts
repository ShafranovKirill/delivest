import { Injectable, Logger } from '@nestjs/common';
import { OutboxService } from '../outbox/outbox.service.js';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { SendAuthCodeEvent } from './events/send-aunt-code.event.js';
import { DelivestEvent } from '../shared/events/types.js';
import { toPrismaJson } from '../utils/to-prisma-json.js';
import { SendCodeType } from '../../generated/prisma/enums.js';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
    private readonly outboxService: OutboxService,
  ) {}
  @Transactional()
  async sendAuthCode(target: string, type: SendCodeType) {
    try {
      this.logger.log(`sendAuthCode() | start sending auth code to ${target}`);

      const code = this.generateFourDigitCode();

      const codeMessage = await this.txHost.tx.authMessage.create({
        data: {
          target,
          type,
          code,
        },
      });

      const event = new SendAuthCodeEvent(codeMessage.id);
      await this.outboxService.save(
        DelivestEvent.AUTH_CODE_REQUESTED,
        toPrismaJson(event),
      );

      return codeMessage;
    } catch (error) {
      this.logger.error(`sendAuthCode() failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private generateFourDigitCode(): string {
    return Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
  }
}
