import { PhotoKey } from '@delivest/common';

export enum DelivestEvent {
  AUTH_CODE_REQUESTED = 'auth-code.requested',
  PRODUCT_PHOTO_CONVERTED = 'product.photo.converted',
  PRODUCT_PHOTO_CONVERSION_FAILED = 'product.photo.conversion.failed',
  CLIENT_LOGGED_IN = 'client.logged.in',
  STAFF_LOGGED_IN = 'staff.logged.in',
}

export interface ClientLoggedInEvent {
  clientId: string;
  sessionId: string;
}

export type PhotoMap = Partial<Record<PhotoKey, string>>;

export interface PhotoConversionEvent {
  targetId: string;
  socketId: string;
  photos: PhotoMap;
}

export interface PhotoConversionFailedEvent {
  fileId: string;
  error: string;
  socketId: string;
}
