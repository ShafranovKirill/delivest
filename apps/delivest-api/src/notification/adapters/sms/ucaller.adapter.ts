/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { IAuthCodeSender } from '@delivest/common';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  UCallerError,
  UCallerInitCallRequest,
  UCallerResponse,
} from '@delivest/types';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UCallerSmsAdapter implements IAuthCodeSender {
  private readonly logger = new Logger(UCallerSmsAdapter.name);
  private readonly initCallApiUrl = 'https://api.ucaller.ru/v1.0/initCall';
  private readonly proxyAgent: HttpsProxyAgent<string>;
  private readonly ucallerServiceId: string;
  private readonly ucallerSecretKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const proxyUrl = this.config.getOrThrow<string>('PROXY_URL');
    this.ucallerSecretKey =
      this.config.getOrThrow<string>('UCALLER_SECRET_KEY');
    this.ucallerServiceId =
      this.config.getOrThrow<string>('UCALLER_SERVICE_ID');
    this.proxyAgent = new HttpsProxyAgent(proxyUrl);
  }

  async send(authCodeId: string): Promise<void> {
    const authRecord = await this.prisma.authMessage.findUnique({
      where: { id: authCodeId },
    });

    const payload: UCallerInitCallRequest = {
      phone: Number(authRecord?.target),
      code: String(authRecord?.code),
      unique: authCodeId,
      voice: true,
    };

    try {
      this.logger.debug(
        `Sending request for [ID: ${authCodeId}]: ${JSON.stringify(payload)}`,
      );
      const { data } = await axios.post<UCallerResponse>(
        this.initCallApiUrl,
        payload,
        {
          httpsAgent: this.proxyAgent,
          proxy: false,
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.ucallerSecretKey}.${this.ucallerServiceId}`,
          },
        },
      );

      this.logger.debug(
        `API Response for [ID: ${authCodeId}]: ${JSON.stringify(data)}`,
      );

      if (data.status === false) {
        this.logger.error(`API Error ${data.code}: ${data.error}`);
        throw new Error(`uCaller_error_${data.code}: ${data.error}`);
      }

      await this.prisma.authMessage.update({
        where: { id: authCodeId },
        data: { callId: String(data.ucaller_id) },
      });

      this.logger.log(
        `Call success: ${authRecord?.target} (ID: ${data.ucaller_id})`,
      );
    } catch (error: unknown) {
      this.handleError(error, authCodeId);
    }
  }

  private handleError(error: unknown, id: string): never {
    if (axios.isAxiosError<UCallerError>(error)) {
      const apiData = error.response?.data;
      const message = apiData?.error || error.message;

      this.logger.error(`Network/HTTP Failure [ID: ${id}]: ${message}`);
      throw new Error(`uCaller_transport_error: ${message}`);
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`Logic/Internal Failure [ID: ${id}]: ${message}`);

    throw error;
  }
}
