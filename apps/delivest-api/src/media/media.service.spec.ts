import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'stream';
import { jest } from '@jest/globals';
import * as AwsSdkLibStorage from '@aws-sdk/lib-storage';
import * as AwsSdkClientS3 from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaService } from './media.service.js';
import { ReadFileDto } from './dto/read-file.dto.js';
import {
  BadRequestException,
  FileNotFoundException,
  FileRetrievalFailedException,
  FileUploadFailedException,
  PayloadTooLargeException,
} from '../shared/exceptions/domain_exception/domain-exception.js';

describe('MediaService', () => {
  let service: MediaService;
  let mockConfigService: {
    getOrThrow: jest.MockedFunction<(key: string) => string>;
  };
  let mockPrisma: {
    mediaFile: {
      create: jest.MockedFunction<any>;
      findUnique: jest.MockedFunction<any>;
      findMany: jest.MockedFunction<any>;
      delete: jest.MockedFunction<any>;
    };
  };
  let mockS3Send: jest.Mock<(...args: any[]) => any>;
  let mockUploadDone: jest.Mock<(...args: any[]) => any>;

  const fileRecord = {
    id: 'file-1',
    bucket: 'test-bucket',
    key: 'target/file-1',
    mimeType: 'image/png',
    originalName: 'file.png',
    size: 5,
    ownerId: 'owner-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    mockS3Send = jest.fn();
    mockUploadDone = jest.fn();

    mockS3Send.mockResolvedValue({});
    mockUploadDone.mockResolvedValue({});

    mockConfigService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          STORAGE_BUCKET_NAME: 'test-bucket',
          STORAGE_ENDPOINT_PUBLIC: 'https://public.test',
          STORAGE_ENDPOINT: 'https://s3.test',
          STORAGE_REGION: 'eu-west-1',
          STORAGE_ACCESS_KEY: 'AKIA_TEST',
          STORAGE_SECRET_KEY: 'SECRET_TEST',
        };
        return values[key];
      }),
    };

    mockPrisma = {
      mediaFile: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    (service as any)['s3'] = { send: mockS3Send };
    (AwsSdkLibStorage.Upload as any).prototype.done = mockUploadDone;
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload file to S3 and save metadata in Prisma', async () => {
      const file = {
        body: Buffer.from('hello'),
        mimeType: 'image/png',
        originalName: 'file.png',
      };

      mockPrisma.mediaFile.create.mockResolvedValue(fileRecord);
      const result = await service.uploadFile(file, 'target');

      expect(mockUploadDone).toHaveBeenCalledTimes(1);
      expect(mockPrisma.mediaFile.create).toHaveBeenCalledWith({
        data: {
          bucket: 'test-bucket',
          key: expect.stringMatching(/^target\//),
          mimeType: 'image/png',
          originalName: 'file.png',
          size: 5,
        },
      });
      expect(result).toBeInstanceOf(ReadFileDto);
      expect(result.url).toBe('https://public.test/test-bucket/target/file-1');
    });

    it('should cleanup S3 and throw BadRequestException if DB save fails', async () => {
      const file = {
        body: Buffer.from('hello'),
        mimeType: 'image/png',
        originalName: 'file.png',
      };

      // @ts-ignore
      mockPrisma.mediaFile.create.mockRejectedValue(new Error('DB failed'));
      mockS3Send.mockResolvedValue(undefined);

      await expect(service.uploadFile(file, 'target')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockS3Send).toHaveBeenCalledWith(
        expect.any(AwsSdkClientS3.DeleteObjectCommand),
      );
    });

    it('should throw FileUploadFailedException when S3 upload fails', async () => {
      const file = {
        body: Buffer.from('hello'),
        mimeType: 'image/png',
        originalName: 'file.png',
      };

      // @ts-ignore
      mockUploadDone.mockRejectedValue(new Error('upload failed'));

      await expect(service.uploadFile(file, 'target')).rejects.toThrow(
        FileUploadFailedException,
      );
      expect(mockPrisma.mediaFile.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return file metadata with public url', async () => {
      mockPrisma.mediaFile.findUnique.mockResolvedValue(fileRecord);

      const result = await service.findOne('file-1');

      expect(result.id).toBe('file-1');
      expect(result.url).toBe('https://public.test/test-bucket/target/file-1');
    });

    it('should throw FileNotFoundException when file is missing', async () => {
      mockPrisma.mediaFile.findUnique.mockResolvedValue(null);

      await expect(service.findOne('file-1')).rejects.toThrow(
        FileNotFoundException,
      );
    });
  });

  describe('getFileStream', () => {
    it('should return stream from S3 when file exists', async () => {
      const readable = Readable.from(['data']);
      mockPrisma.mediaFile.findUnique.mockResolvedValue(fileRecord);
      mockS3Send.mockResolvedValue({ Body: readable });

      const result = await service.getFileStream('file-1');

      expect(result).toBe(readable);
      expect(mockS3Send).toHaveBeenCalledWith(
        expect.any(AwsSdkClientS3.GetObjectCommand),
      );
    });

    it('should throw FileRetrievalFailedException when S3 download fails', async () => {
      mockPrisma.mediaFile.findUnique.mockResolvedValue(fileRecord);
      // @ts-ignore
      mockS3Send.mockRejectedValue(new Error('download failed'));

      await expect(service.getFileStream('file-1')).rejects.toThrow(
        FileRetrievalFailedException,
      );
    });

    it('should throw FileNotFoundException when file record is missing', async () => {
      mockPrisma.mediaFile.findUnique.mockResolvedValue(null);

      await expect(service.getFileStream('file-1')).rejects.toThrow(
        FileNotFoundException,
      );
    });
  });

  describe('getFileBuffer', () => {
    it('should return buffer from S3 stream', async () => {
      const readable = Readable.from([Buffer.from('ab'), Buffer.from('cd')]);
      mockPrisma.mediaFile.findUnique.mockResolvedValue(fileRecord);
      mockS3Send.mockResolvedValue({ Body: readable });

      const result = await service.getFileBuffer('file-1');

      expect(result).toEqual(Buffer.from('abcd'));
      expect(mockS3Send).toHaveBeenCalledWith(
        expect.any(AwsSdkClientS3.GetObjectCommand),
      );
    });

    it('should throw PayloadTooLargeException when file is too large', async () => {
      mockPrisma.mediaFile.findUnique.mockResolvedValue({
        ...fileRecord,
        size: 21 * 1024 * 1024,
      });

      await expect(service.getFileBuffer('file-1')).rejects.toThrow(
        PayloadTooLargeException,
      );
    });
  });

  describe('deleteFile', () => {
    it('should remove file from S3 and Prisma', async () => {
      mockPrisma.mediaFile.findUnique.mockResolvedValue(fileRecord);
      mockS3Send.mockResolvedValue(undefined);
      mockPrisma.mediaFile.delete.mockResolvedValue(undefined);

      await service.deleteFile('file-1');

      expect(mockS3Send).toHaveBeenCalledWith(
        expect.any(AwsSdkClientS3.DeleteObjectCommand),
      );
      expect(mockPrisma.mediaFile.delete).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
    });

    it('should throw BadRequestException when S3 deletion fails', async () => {
      mockPrisma.mediaFile.findUnique.mockResolvedValue(fileRecord);
      // @ts-ignore
      mockS3Send.mockRejectedValue(new Error('delete failed'));

      await expect(service.deleteFile('file-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.mediaFile.delete).not.toHaveBeenCalled();
    });

    it('should throw FileNotFoundException when file is missing', async () => {
      mockPrisma.mediaFile.findUnique.mockResolvedValue(null);

      await expect(service.deleteFile('file-1')).rejects.toThrow(
        FileNotFoundException,
      );
    });
  });

  describe('generatePublicUrl', () => {
    it('should build public url from bucket and key', () => {
      expect(service.generatePublicUrl('folder/file.png')).toBe(
        'https://public.test/test-bucket/folder/file.png',
      );
    });
  });

  describe('onModuleInit', () => {
    it('should create bucket and set policy when bucket does not exist', async () => {
      const error = new Error('Not found');
      (error as any).$metadata = { httpStatusCode: 404 };
      mockS3Send
        // @ts-ignore
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      await service.onModuleInit();

      expect(mockS3Send).toHaveBeenCalledTimes(3);
      expect(mockS3Send).toHaveBeenNthCalledWith(
        1,
        expect.any(AwsSdkClientS3.HeadBucketCommand),
      );
      expect(mockS3Send).toHaveBeenNthCalledWith(
        2,
        expect.any(AwsSdkClientS3.CreateBucketCommand),
      );
      expect(mockS3Send).toHaveBeenNthCalledWith(
        3,
        expect.any(AwsSdkClientS3.PutBucketPolicyCommand),
      );
    });
  });

  describe('getFilesByKeys', () => {
    it('should return dto list for the requested keys', async () => {
      mockPrisma.mediaFile.findMany.mockResolvedValue([fileRecord]);

      const result = await service.getFilesByKeys(['target/file-1']);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ReadFileDto);
      expect(result[0].id).toBe('file-1');
    });
  });
});
