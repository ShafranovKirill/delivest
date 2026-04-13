import { PhotoKey } from '@delivest/common';

export interface ChildResult {
  key: PhotoKey;
  fileKey: string;
  success: boolean;
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
