import { AccessClientTokenPayload } from '@delivest/types';

declare global {
  namespace Express {
    interface Request {
      client: AccessClientTokenPayload;
    }
  }
}
