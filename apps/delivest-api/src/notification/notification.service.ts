import { Injectable, Logger } from '@nestjs/common';
import { OutboxService } from '../outbox/outbox.service.js';
import { Transactional } from '@nestjs-cls/transactional';
import { SendAuthCodeEvent } from './events/send-aunt-code.event.js';
import { DelivestEvent } from '../shared/events/types.js';
import { toPrismaJson } from '../utils/to-prisma-json.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly outboxService: OutboxService,
    private readonly prisma: PrismaService,
  ) {}

  @Transactional()
  async publishAuthEvent(authCodeId: string) {
    try {
      const event = new SendAuthCodeEvent(authCodeId);
      await this.outboxService.save(
        DelivestEvent.AUTH_CODE_REQUESTED,
        toPrismaJson(event),
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish auth event for ID: ${authCodeId}. Error: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
