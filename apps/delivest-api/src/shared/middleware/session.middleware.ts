import { COOKIE_NAMES } from '@delivest/common';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { isProd } from '../../utils/env.js';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const COOKIE_NAME = COOKIE_NAMES.SESSION_ID;
    const sessionTtlDays = 30;

    const existingSessionId = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!existingSessionId) {
      const newSessionId = uuidv4();

      const sessionMaxAge = 1000 * 60 * 60 * 24 * sessionTtlDays;

      res.cookie(COOKIE_NAME, newSessionId, {
        httpOnly: true,
        secure: isProd(),
        sameSite: 'lax',
        maxAge: sessionMaxAge,
        path: '/',
      });

      req.cookies[COOKIE_NAME] = newSessionId;
    }

    next();
  }
}
