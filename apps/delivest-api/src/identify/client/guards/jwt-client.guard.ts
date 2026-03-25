import { AccessClientTokenPayload } from '@delivest/types';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

@Injectable()
export class JwtClientAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtClientAuthGuard.name);
  private readonly accessSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret = this.configService.get<string>(
      'JWT_ACCESS_SECRET_CLIENT',
      '',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      this.logger.warn('Missing Authorization header');
      throw new UnauthorizedException('Missing token');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer') {
      throw new UnauthorizedException('Invalid authorization scheme');
    }

    if (!token) {
      throw new UnauthorizedException('Invalid token format');
    }

    try {
      const payload = this.jwtService.verify<AccessClientTokenPayload>(token, {
        secret: this.accessSecret,
      });
      request.client = payload;
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Token verification failed: ${message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
