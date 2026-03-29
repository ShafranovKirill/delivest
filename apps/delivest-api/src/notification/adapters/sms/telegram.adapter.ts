import { IAuthCodeSender } from '@delivest/common';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
@Injectable()
export class TelegramSmsAdapter implements IAuthCodeSender {
  private readonly logger = new Logger(TelegramSmsAdapter.name);
  constructor(private readonly prisma: PrismaService) {}

  async send(authCodeId: string) {
    try {
      const message = await this.prisma.authMessage.findUnique({
        where: { id: authCodeId },
      });
      this.logger.log(
        `[DEV-TG] Sending code ${message?.code} to number ${message?.phone}`,
      );
    } catch (err) {
      this.logger.error(
        `[Telegram] Failed to reach API: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
