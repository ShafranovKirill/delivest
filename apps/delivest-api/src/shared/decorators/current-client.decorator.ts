import { AccessClientTokenPayload } from '@delivest/types';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentClient = createParamDecorator(
  (key: keyof AccessClientTokenPayload, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();

    return key ? req.client?.[key] : req.client;
  },
);
