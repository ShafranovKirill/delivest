import { Injectable, Logger } from '@nestjs/common';
import { OutboxService } from '../outbox/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Transactional } from '@nestjs-cls/transactional';
import { SendAuthCodeEvent } from './events/send-aunt-code.event.js';
import { DelivestEvent } from '../shared/events/types.js';
import { toPrismaJson } from '../utils/to-prisma-json.js';
import { ForbiddenException } from '../shared/exception/domain_exception/domain-exception.js';
import { SendCodeType } from '../../generated/prisma/enums.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
  ) {}
  @Transactional()
  async sendAuthCode(target: string, type: SendCodeType) {
    try {
      this.logger.log(`sendAuthCode() | start sending auth code to ${target}`);

      const code = this.generateFourDigitCode();

      const codeMessage = await this.prisma.authMessage.create({
        data: {
          target: target,
          code: code,
          type: type,
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

  async checkAuthCode(target: string, code: string) {
    try {
      const codeMessage = await this.prisma.authMessage.findFirst({
        where: { target },
      });

      if (code === codeMessage?.code) {
        return;
      } else {
        throw new ForbiddenException();
      }
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
