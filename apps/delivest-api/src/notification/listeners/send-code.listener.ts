/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DelivestEvent } from '../../shared/events/types.js';
import { SendAuthCodeEvent } from '../events/send-aunt-code.event.js';
import type { IAuthCodeSender } from '@delivest/common';

@Injectable()
export class SendCodeListener {
  private readonly logger = new Logger(SendCodeListener.name);
  constructor(
    @Inject('IAuthCodeSender') private readonly authCodeSender: IAuthCodeSender,
  ) {}

  @OnEvent(DelivestEvent.AUTH_CODE_REQUESTED)
  async handleSendAuthCode(payload: SendAuthCodeEvent) {
    try {
      await this.authCodeSender.send(payload.authCodeId);
    } catch (err) {
      this.logger.error(`handleSendAuthCode() | ${(err as Error).message}`);
      return err as Error;
    }
  }
}
