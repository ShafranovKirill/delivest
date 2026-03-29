import { IAuthCodeSender } from '@delivest/common';
import { Injectable, Logger } from '@nestjs/common';
@Injectable()
export class TelegramSmsAdapter implements IAuthCodeSender {
  private readonly logger = new Logger(TelegramSmsAdapter.name);

  async send(phone: string, code: string) {
    try {
      this.logger.log(`[DEV-TG] Sending code ${code} to ${phone}`);
    } catch (err) {
      this.logger.error(
        `[Telegram] Failed to reach API: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
