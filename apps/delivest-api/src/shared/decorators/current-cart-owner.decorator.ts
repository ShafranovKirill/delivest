import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { COOKIE_NAMES } from '@delivest/common';
import { CartOwner } from '../../oms/cart/interfaces/cart-owner.interface.js';
import type { Request } from 'express';
import { UnauthorizedException } from '../exceptions/domain_exception/domain-exception.js';

export const CurrentCartOwner = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CartOwner => {
    const request = ctx.switchToHttp().getRequest<Request>();

    const client = request.client;
    const cookies = request.cookies as Record<string, string | undefined>;
    const sessionId = cookies[COOKIE_NAMES.SESSION_ID];

    if (client?.sub) {
      return { clientId: client.sub };
    }

    if (sessionId) {
      return { sessionId };
    }

    throw new UnauthorizedException(
      'Cart owner could not be identified (no session or client token)',
    );
  },
);
