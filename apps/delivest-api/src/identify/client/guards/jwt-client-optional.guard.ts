import { AccessClientTokenPayload } from '@delivest/types';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UnauthorizedException } from '../../../shared/exceptions/domain_exception/domain-exception.js';

@Injectable()
export class OptionalJwtClientAuthGuard implements CanActivate {
  private readonly logger = new Logger(OptionalJwtClientAuthGuard.name);

  private readonly accessSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret = this.configService.getOrThrow<string>(
      'JWT_ACCESS_SECRET_CLIENT',
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return true;
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return true;
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
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    return true;
  }
}
