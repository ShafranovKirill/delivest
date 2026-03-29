import { IAuthCodeSender } from '@delivest/common';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UCallerSmsAdapter implements IAuthCodeSender {
  async send(phone: string, code: string) {
    console.log(`[PROD-uCaller] Making call to ${phone} with code ${code}`);
  }
}
