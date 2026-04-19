import { Expose } from 'class-transformer';

export class ReadFileDto {
  @Expose()
  id!: string;

  @Expose()
  url!: string | null;

  @Expose()
  originalName!: string;

  @Expose()
  mimeType!: string;

  @Expose()
  size!: number;

  @Expose()
  key!: string;

  @Expose()
  ownerId!: string;

  @Expose()
  createdAt!: Date;
}
