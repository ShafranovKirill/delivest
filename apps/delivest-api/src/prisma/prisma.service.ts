/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  constructor(configService: ConfigService) {
    const pool = new Pool({
      connectionString: configService.get<string>('DATABASE_URL'),
    });
    const adapter = new PrismaPg(pool as any);

    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();

      await this.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        'Prisma connect | Failed to connect to the database',
        (error as Error).message,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
