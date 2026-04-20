import { Readable } from 'stream';

export interface UploadFile {
  body: Buffer | Readable;
  originalName: string;
  mimeType: string;
  size?: number;
}
