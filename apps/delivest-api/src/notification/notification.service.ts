import { Injectable, Logger } from '@nestjs/common';
import { OutboxService } from '../outbox/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Transactional } from '@nestjs-cls/transactional';
import { SendAuthCodeEvent } from './events/send-aunt-code.event.js';
import { DelivestEvent } from '../shared/events/types.js';
import { toPrismaJson } from '../utils/to-prisma-json.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
  ) {}
  @Transactional()
  async sendAuthCode(phone: string) {
    try {
      this.logger.log(`sendAuthCode() | start sending auth code to ${phone}`);

      const code = this.generateFourDigitCode();

      const codeMessage = await this.prisma.authMessage.create({
        data: {
          phone: phone,
          code: code,
        },
      });

      const event = new SendAuthCodeEvent(
        codeMessage.id,
        codeMessage.phone,
        codeMessage.code,
      );

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
