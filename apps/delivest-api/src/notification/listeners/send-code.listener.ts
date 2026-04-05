import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DelivestEvent } from '../../shared/events/types.js';
import { SendAuthCodeEvent } from '../events/send-aunt-code.event.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { IAuthCodeSender } from '@delivest/common';

@Injectable()
export class SendCodeListener {
  private readonly logger = new Logger(SendCodeListener.name);
  constructor(
    private readonly prisma: PrismaService,

    @Inject('IAuthCodeSender')
    private readonly authCodeSender: IAuthCodeSender,
  ) {}

  @OnEvent(DelivestEvent.AUTH_CODE_REQUESTED)
  async handleSendAuthCode(payload: SendAuthCodeEvent) {
    try {
      const message = await this.prisma.authMessage.findUnique({
        where: { id: payload.authCodeId },
      });

      if (!message) {
        this.logger.warn(
          `handleSendAuthCode() | No auth message found for ID ${payload.authCodeId}`,
        );
        return;
      }

      switch (message.type) {
        case 'ZVONOK':
          await this.SendAuthCode(payload);
          break;
        default:
          this.logger.warn(
            `handleSendAuthCode() | Unsupported message type: ${message.type as string}`,
          );
      }
    } catch (err) {
      this.logger.error(`handleSendAuthCode() | ${(err as Error).message}`);
      return err as Error;
    }
  }

  async SendAuthCode(payload: SendAuthCodeEvent) {
    await this.authCodeSender.send(payload.authCodeId);
  }
}
