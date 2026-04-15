import sharp from 'sharp';

export enum PhotoConvertFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif',
  HEIF = 'heif',
  GIF = 'gif',
  TIFF = 'tiff',
}

export interface ProductPhotos {
  [profileKey: string]: string | undefined;
}

export type SharpPosition =
  | 'centre'
  | 'center'
  | 'top'
  | 'right top'
  | 'right'
  | 'right bottom'
  | 'bottom'
  | 'left bottom'
  | 'left'
  | 'left top'
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest'
  | 'entropy'
  | 'attention';

export interface PhotoProfile {
  format?: PhotoConvertFormat;
  width: number;
  height: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: SharpPosition;
  quality?: number;
  background?: string | sharp.RGBA;
}

export const PHOTO_PROFILES = {
  PRODUCT_CARD: {
    format: PhotoConvertFormat.WEBP,
    width: 600,
    height: 480,
    fit: 'contain' as const,
    position: 'centre',
    quality: 90,
    background: '#FFFFFF',
  },
  PRODUCT_PREVIEW: {
    format: PhotoConvertFormat.WEBP,
    width: 200,
    height: 200,
    fit: 'contain' as const,
    position: 'centre',
    quality: 90,
    background: '#FFFFFF',
  },
} as const satisfies Record<string, PhotoProfile>;
