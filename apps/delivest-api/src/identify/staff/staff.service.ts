import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {
    this.accessTtl = +this.config.get<number>(
      'JWT_ACCESS_TTL_SECONDS_CLIENT',
      900,
    );
    this.refreshTtl = +this.config.get<number>(
      'JWT_REFRESH_TTL_SECONDS_CLIENT',
      604800,
    );
    this.accessSecret = this.config.get<string>('JWT_ACCESS_SECRET_CLIENT', '');
    this.refreshSecret = this.config.get<string>(
      'JWT_REFRESH_SECRET_CLIENT',
      '',
    );
  }
}
