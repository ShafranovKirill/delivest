export type ImageFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'heif'
  | 'gif'
  | 'tiff'
  | 'avif';

export interface PhotoProfile {
  format?: ImageFormat;
  width?: number;
  height?: number;
}

export interface PhotoJobData {
  fileId: string;
  profile: PhotoProfile;
  socketId: string;
}
