import { IAuthCodeSender } from '@delivest/common';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';

@Injectable()
export class UCallerSmsAdapter implements IAuthCodeSender {
  private readonly logger = new Logger(UCallerSmsAdapter.name);

  constructor(private readonly prisma: PrismaService) {}
  async send(authCodeId: string) {
    try {
      const message = await this.prisma.authMessage.findUnique({
        where: { id: authCodeId },
      });
      this.logger.log(
        `[PROD-uCaller] Making call to ${message?.phone} with code ${message?.code}`,
      );
    } catch (err) {
      this.logger.error(
        `[Telegram] Failed to reach API: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
