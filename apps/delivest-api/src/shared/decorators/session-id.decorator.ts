import { COOKIE_NAMES } from '@delivest/common';
import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

export const SessionId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const cookies = request.cookies as Record<string, string | undefined>;
    const sessionId = cookies[COOKIE_NAMES.SESSION_ID];

    if (!sessionId) {
      throw new BadRequestException(
        'Session not initialized. Please refresh page.',
      );
    }

    return sessionId;
  },
);
