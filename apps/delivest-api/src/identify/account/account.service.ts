import { RefreshTokenPayload } from '@delivest/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.accessTtl = +this.config.get<number>('JWT_ACCESS_TTL_SECONDS', 900);
    this.refreshTtl = +this.config.get<number>(
      'JWT_REFRESH_TTL_SECONDS',
      604800,
    );
    this.accessSecret = this.config.get<string>('JWT_ACCESS_SECRET', '');
    this.refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET', '');
  }

  async generateAccessToken() {}

  async generateRefreshToken(id: string, login: string) {
    const payload: RefreshTokenPayload = {
      sub: id,
      username: login,
    };
    return this.jwt.signAsync(payload, {
      expiresIn: this.refreshTtl,
      secret: this.refreshSecret,
    });
  }

  setRefreshCookie(res: Response, token: string): void {
    const refreshMaxAge = this.refreshTtl * 1000;

    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: refreshMaxAge,
    });
  }
}
