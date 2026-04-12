import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { Upload } from '@aws-sdk/lib-storage';

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { ReadFileDto } from './dto/read-file.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toDto } from '../utils/to-dto.js';
import { MediaFile } from '../../generated/prisma/client.js';
import { Readable } from 'stream';
import {
  BadRequestException,
  FileNotFoundException,
  FileRetrievalFailedException,
  FileUploadFailedException,
  PayloadTooLargeException,
} from '../shared/exceptions/domain_exception/domain-exception.js';
import { UploadFile } from './interface/upload-file.interface.js';
import type { EntityModelName, PhotoDelegate } from '@delivest/types';
type PhotosRecord = Record<string, string>;
@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly endpointPublic: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = this.config.getOrThrow<string>('STORAGE_BUCKET_NAME');
    this.endpointPublic = this.config.getOrThrow<string>(
      'STORAGE_ENDPOINT_PUBLIC',
    );

    this.s3 = new S3Client({
      endpoint: config.getOrThrow<string>('STORAGE_ENDPOINT'),
      region: this.config.getOrThrow<string>('STORAGE_REGION'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('STORAGE_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('STORAGE_SECRET_KEY'),
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  async uploadFile(file: UploadFile, folder?: string): Promise<ReadFileDto> {
    const fileKey = folder ? `${folder}/${uuid()}` : `${uuid()}`;
    try {
      const upload = new Upload({
        client: this.s3,
        params: {
          Bucket: this.bucket,
          Key: fileKey,
          Body: file.body,
          ContentType: file.mimeType,
        },
      });
      await upload.done();
    } catch (error) {
      this.logger.error(
        `uploadFile() | upload file error ${(error as Error).message}`,
      );
      throw new FileUploadFailedException();
    }

    try {
      const saved = await this.prisma.mediaFile.create({
        data: {
          bucket: this.bucket,
          key: fileKey,
          mimeType: file.mimeType,
          originalName: file.originalName,
          size:
            file.body instanceof Buffer ? file.body.length : (file.size ?? 0),
        },
      });
      const dto = toDto(saved, ReadFileDto);
      dto.url = this.generatePublicUrl(saved);

      return dto;
    } catch (error: unknown) {
      this.logger.error(
        `upload() | DB Save Failed. Cleaning up S3... | key=${fileKey}`,
        (error as Error).stack,
      );
      try {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: fileKey }),
        );
        this.logger.log(`upload() | Cleanup successful | key=${fileKey}`);
      } catch (cleanupError) {
        this.logger.error(
          `upload() | CRITICAL: Failed to cleanup S3 after DB error | key=${fileKey}`,
          cleanupError,
        );
      }
      throw new BadRequestException();
    }
  }

  async findOne(fileId: string): Promise<ReadFileDto> {
    const file = await this.prisma.mediaFile.findUnique({
      where: { id: fileId },
    });
    if (!file) throw new FileNotFoundException();
    const dto = toDto(file, ReadFileDto);
    dto.url = this.generatePublicUrl(file);
    return dto;
  }

  async getFileStream(fileId: string): Promise<Readable> {
    const file = await this.prisma.mediaFile.findUnique({
      where: { id: fileId },
    });

    if (!file) throw new FileNotFoundException();

    try {
      const command = new GetObjectCommand({
        Bucket: file.bucket,
        Key: file.key,
      });

      const response = await this.s3.send(command);
      return response.Body as Readable;
    } catch (error) {
      this.logger.error(`getFileStream() | S3 Error for id=${fileId}`, error);
      throw new FileRetrievalFailedException();
    }
  }

  async getFileBuffer(fileId: string) {
    const file = await this.prisma.mediaFile.findUnique({
      where: { id: fileId },
    });
    if (!file) {
      throw new FileNotFoundException();
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new PayloadTooLargeException();
    }
    try {
      const command = new GetObjectCommand({
        Bucket: file.bucket,
        Key: file.key,
      });

      const response = await this.s3.send(command);
      const stream = response.Body as Readable;

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`getFileBuffer() | S3 Error for id=${fileId}`, error);
      throw new FileRetrievalFailedException();
    }
  }

  async deleteFile(fileId: string) {
    const file = await this.prisma.mediaFile.findUnique({
      where: { id: fileId },
    });
    if (!file) {
      throw new FileNotFoundException();
    }
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: file.bucket,
          Key: file.key,
        }),
      );
    } catch {
      this.logger.warn(
        `deleteFile() | Failed to delete from S3 | key=${file.key}`,
      );
      throw new BadRequestException();
    }

    await this.prisma.mediaFile.delete({ where: { id: fileId } });

    this.logger.log(`deleteFile() | Delete file ${fileId}`);
  }

  private generatePublicUrl(file: MediaFile): string {
    return `${this.endpointPublic}/${this.bucket}/${file.key}`;
  }

  private async ensureBucketExists() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode === 404) {
        this.logger.log(
          `Bucket "${this.bucket}" not found. Initializing setup...`,
        );

        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));

        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicRead',
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        };

        await this.s3.send(
          new PutBucketPolicyCommand({
            Bucket: this.bucket,
            Policy: JSON.stringify(policy),
          }),
        );

        this.logger.log(
          `Bucket "${this.bucket}" created and policy set to PUBLIC`,
        );
      } else {
        this.logger.error(`Error checking S3 bucket: ${error.message}`);
        throw error;
      }
    }
  }

  async getEntityUrlsMap<T extends EntityModelName>(
    entityName: T,
    targetIds: string[],
    photoKey: string,
  ): Promise<Record<string, string>> {
    const uniqueTargetIds = [...new Set(targetIds.filter(Boolean))];
    if (uniqueTargetIds.length === 0) return {};

    const delegate = this.getDelegate(entityName);

    const entities = await delegate.findMany({
      where: { id: { in: uniqueTargetIds } },
      select: { id: true, photos: true },
    });

    const entityToMediaId = new Map<string, string>();
    const allMediaIds: string[] = [];

    entities.forEach((entity) => {
      const photos = entity.photos as PhotosRecord;
      const mediaId = photos?.[photoKey];

      if (mediaId) {
        entityToMediaId.set(entity.id, mediaId);
        allMediaIds.push(mediaId);
      }
    });

    const photoUrlsMap = await this.getUrlsMap(allMediaIds);

    const result: Record<string, string> = {};

    entityToMediaId.forEach((mediaId, entityId) => {
      const url = photoUrlsMap[mediaId];
      if (url) {
        result[entityId] = url;
      }
    });

    return result;
  }

  async getUrlsMap(fileIds: string[]): Promise<Record<string, string>> {
    const uniqueIds = [...new Set(fileIds.filter(Boolean))];

    if (uniqueIds.length === 0) return {};

    const files = await this.prisma.mediaFile.findMany({
      where: {
        id: { in: uniqueIds },
      },
      select: {
        id: true,
        key: true,
        bucket: true,
      },
    });

    return files.reduce(
      (acc, file) => {
        acc[file.id] = this.generatePublicUrl(file as MediaFile);
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  private getDelegate<T extends EntityModelName>(entityName: T): PhotoDelegate {
    const delegate = (this.prisma as unknown as Record<T, PhotoDelegate>)[
      entityName
    ];
    if (!delegate) throw new Error(`Prisma model "${entityName}" not found`);
    if (!delegate) {
      throw new Error(`Prisma model "${String(entityName)}" not found`);
    }
    return delegate;
  }

  private async getEntityPhotos<T extends EntityModelName>(
    entityName: T,
    targetId: string,
  ): Promise<PhotosRecord | null> {
    const entity = await this.getDelegate(entityName).findUnique({
      where: { id: targetId },
      select: { photos: true },
    });

    if (!entity) {
      this.logger.warn(`${entityName}:${targetId} not found`);
      return null;
    }

    return (entity.photos as PhotosRecord) || {};
  }

  async upsertBatch<T extends EntityModelName>(
    entityName: T,
    targetId: string,
    newPhotos: PhotosRecord,
  ) {
    const currentPhotos = await this.getEntityPhotos(entityName, targetId);
    if (currentPhotos === null) return;

    const oldFileIdsToDelete = Object.keys(newPhotos)
      .map((key) => currentPhotos[key])
      .filter(
        (oldId): oldId is string =>
          !!oldId && !Object.values(newPhotos).includes(oldId),
      );

    const updatedEntity = await this.getDelegate(entityName).update({
      where: { id: targetId },
      data: {
        photos: { ...currentPhotos, ...newPhotos },
      },
      select: { photos: true },
    });

    if (oldFileIdsToDelete.length > 0) {
      this.cleanupOldFiles(oldFileIdsToDelete);
    }

    return updatedEntity;
  }

  private cleanupOldFiles(ids: string[]) {
    Promise.all(ids.map((id) => this.deleteFile(id))).catch((err) =>
      this.logger.error(`Cleanup failed`, err),
    );
  }
}
