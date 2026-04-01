import { IAuthCodeSender } from '@delivest/common';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';

@Injectable()
export class DevelopSmsAdapter implements IAuthCodeSender {
  private readonly logger = new Logger(DevelopSmsAdapter.name);
  constructor(private readonly prisma: PrismaService) {}

  async send(authCodeId: string): Promise<void> {
    try {
      this.logger.debug(`start sending message to console`);
      const authRecord = await this.prisma.authMessage.findUnique({
        where: { id: authCodeId },
      });

      if (!authRecord) {
        this.logger.warn(`Record with ID ${authCodeId} not found`);
        return;
      }

      const messageText =
        `🔑 *Новый код подтверждения*\n\n` +
        `👤 **ID:** \`${authRecord.id}\`\n` +
        `📞 **Номер:** \`${authRecord.target}\`\n` +
        `🔢 **Код:** \`${authRecord.code}\``;

      this.logger.debug(`${messageText}`);
    } catch (err) {
      this.logger.error(`Failed to send message: ${(err as Error).message}`);
      throw err;
    }
  }
}
