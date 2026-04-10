export enum DelivestEvent {
  AUTH_CODE_REQUESTED = 'auth-code.requested',
}

export enum PhotoEvent {
  PRODUCT_PHOTO_CONVERTED = 'product.photo.converted',
  PRODUCT_PHOTO_CONVERSION_FAILED = 'product.photo.conversion.failed',
}

export interface PhotoConvertedEvent {
  targetId: string;
  originalFileId: string;
  newFileId: string;
  profileKey: string;
  socketId: string;
}

export interface PhotoConversionFailedEvent {
  fileId: string;
  error: string;
  socketId: string;
}
