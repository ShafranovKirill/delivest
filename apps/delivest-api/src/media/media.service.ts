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
import { Readable } from 'stream';
import {
  BadRequestException,
  FileNotFoundException,
  FileRetrievalFailedException,
  FileUploadFailedException,
  PayloadTooLargeException,
} from '../shared/exceptions/domain_exception/domain-exception.js';
import { UploadFile } from './interface/upload-file.interface.js';

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
      dto.url = this.generatePublicUrl(saved.key);

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
    dto.url = this.generatePublicUrl(file.key);
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

  generatePublicUrl(fileKey: string | null | undefined): string | null {
    if (!fileKey) {
      return null;
    }
    return `${this.endpointPublic}/${this.bucket}/${fileKey}`;
  }

  async deleteFilesByKeys(keys: string[]) {
    for (const key of keys) {
      try {
        await this.s3.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
          }),
        );
        this.logger.log(`deleteFilesByKeys() | Deleted from S3 | key=${key}`);
      } catch (error) {
        this.logger.warn(
          `deleteFilesByKeys() | Failed to delete from S3 | key=${key}`,
          error,
        );
      }
    }
  }

  async getFilesByKeys(keys: string[]): Promise<ReadFileDto[]> {
    const files = await this.prisma.mediaFile.findMany({
      where: {
        key: { in: keys },
      },
    });

    return files.map((file) => toDto(file, ReadFileDto));
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
}
