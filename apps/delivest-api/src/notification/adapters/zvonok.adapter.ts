import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import axios, { AxiosError } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ConfigService } from '@nestjs/config';
import {
  ZvonokErrorResponse,
  ZvonokResponse,
  ZvonokTellCodeParams,
} from '@delivest/types';

@Injectable()
export class ZvonokAuthAdapter {
  private readonly logger = new Logger(ZvonokAuthAdapter.name);

  private readonly publicKey: string;
  private readonly campaignId: string;

  private readonly apiUrl =
    'https://zvonok.com/manager/cabapi_external/api/v1/phones/tellcode/';
  private readonly proxyAgent: HttpsProxyAgent<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const proxyUrl = this.config.getOrThrow<string>('PROXY_URL');
    this.publicKey = this.config.getOrThrow<string>('ZVONOK_PUBLIC_KEY');
    this.campaignId = this.config.getOrThrow<string>('ZVONOK_CAMPAIGN_ID');
    this.proxyAgent = new HttpsProxyAgent(proxyUrl);
  }

  async send(authCodeId: string): Promise<void> {
    const authRecord = await this.prisma.authMessage.findUnique({
      where: { id: authCodeId },
    });

    if (!authRecord) {
      throw new Error(`Auth record with id ${authCodeId} not found`);
    }

    const payload: ZvonokTellCodeParams = {
      public_key: this.publicKey,
      campaign_id: this.campaignId,
      phone: authRecord.target,
      pincode: String(authRecord.code),
    };

    const params = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) =>
      params.append(key, String(value)),
    );

    try {
      this.logger.debug(`Sending Zvonok TellCode to ${payload.phone}`);

      const { data } = await axios.post<ZvonokResponse>(this.apiUrl, params, {
        httpsAgent: this.proxyAgent,
        proxy: false,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (data.status === 'error') {
        const errorMsg =
          typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
        throw new Error(`zvonok_api_error: ${errorMsg}`);
      }

      await this.prisma.authMessage.update({
        where: { id: authCodeId },
        data: { callId: String(data.data.call_id) },
      });

      this.logger.log(
        `Zvonok Success: ${payload.phone} (CallID: ${data.data.call_id})`,
      );
    } catch (error: unknown) {
      this.handleError(error, authCodeId);
    }
  }

  private handleError(error: unknown, id: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ZvonokErrorResponse>;
      const apiData = axiosError.response?.data;

      const message =
        apiData?.status === 'error'
          ? JSON.stringify(apiData.data)
          : axiosError.message;

      this.logger.error(`Zvonok API Failure [ID: ${id}]: ${message}`);
      throw new Error(`zvonok_transport_error: ${message}`);
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(`Internal Failure [ID: ${id}]: ${message}`);
    throw error;
  }
}
