import { jest } from '@jest/globals';

jest.unstable_mockModule('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

const argon2 = await import('argon2');

jest.unstable_mockModule('@nestjs-cls/transactional', () => ({
  TransactionHost: class {
    get tx() {
      return {};
    }
  },
  Transactional:
    () => (target: any, key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

const { TransactionHost } = await import('@nestjs-cls/transactional');

import { PrismaService } from '../../prisma/prisma.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Client,
  Prisma,
  SendCodeType,
} from '../../../generated/prisma/client.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadClientDto } from './dto/read.dto.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PhoneAlreadyExistsException,
  ResendLimitExceededException,
  ResendTooFastException,
  UserNotFoundException,
  UserNotRegisteredException,
} from '../../shared/exception/domain_exception/domain-exception.js';

import { CreateClientDto } from './dto/create.dto.js';

import type { ClientService as ClientServiceType } from './client.service.js';
import { AdminReadClientDto } from './dto/admin-read.dto.js';
import { UpdateClientDto } from './dto/update.dto.js';
import { NotificationService } from '../../notification/notification.service.js';

describe('ClientService', () => {
  let service: ClientServiceType;
  let mockPrisma: any;
  let notificationService: NotificationService;

  const mockArgonVerify = argon2.verify as unknown as jest.MockedFunction<
    typeof argon2.verify
  >;
  const mockArgonHash = argon2.hash as unknown as jest.MockedFunction<
    typeof argon2.hash
  >;

  const notificationMock = {
    sendAuthCode: jest.fn<any>().mockResolvedValue({ success: true }),
    checkAuthCode: jest.fn(),
    publishAuthEvent: jest.fn().mockImplementation(() => Promise.resolve()),
  };

  const mockClient: Client = {
    id: '1',
    name: 'John Doe',
    phone: '1234567890',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  const mockAuthMessageRecord = {
    id: 'auth-id-123',
    target: '+79161234567',
    code: '1234',
    status: 'PENDING',
    resendCount: 0,
    updatedAt: new Date(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 300000),
  };

  const mockTx = {
    authMessage: {
      findFirst: jest.fn() as jest.MockedFunction<any>,
      update: jest.fn() as jest.MockedFunction<any>,
      create: jest.fn() as jest.MockedFunction<any>,
    },
  };

  const mockTxHost = {
    tx: mockTx,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const { ClientService } = await import('./client.service.js');

    const prismaMock = {
      client: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      authMessage: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JWT_ACCESS_TTL_SECONDS_CLIENT: 900,
                JWT_REFRESH_TTL_SECONDS_CLIENT: 604800,
                JWT_ACCESS_SECRET_CLIENT: 'ACCESS_SECRET',
                JWT_REFRESH_SECRET_CLIENT: 'REFRESH_SECRET',
                NODE_ENV: 'test',
              };
              return config[key as keyof typeof config] || 900;
            }),
          },
        },
        { provide: NotificationService, useValue: notificationMock },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() },
        },
        { provide: TransactionHost, useValue: mockTxHost },
      ],
    }).compile();

    service = module.get<ClientServiceType>(ClientService);
    mockPrisma = module.get(PrismaService);
    notificationService = module.get<NotificationService>(NotificationService);

    // Внутри beforeEach, после инициализации prismaMock:
    mockTx.authMessage.findFirst.mockResolvedValue(null);
    mockTx.authMessage.create.mockResolvedValue(mockAuthMessageRecord);
    mockTx.authMessage.update.mockResolvedValue(mockAuthMessageRecord);

    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
  });

  describe('sendCode', () => {
    const rawPhone = '89161234567';
    const normalizedPhone = '+79161234567';

    it('should send code to existing client', async () => {
      const validateSpy = jest
        .spyOn(service, 'validatePhoneNumber')
        .mockReturnValue(normalizedPhone);

      mockPrisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        phone: normalizedPhone,
      });

      mockTx.authMessage.findFirst.mockResolvedValue(null);

      await service.sendCode(rawPhone, SendCodeType.UCALLER);

      expect(mockTx.authMessage.create).toHaveBeenCalled();

      expect(notificationService.publishAuthEvent).toHaveBeenCalledWith(
        'auth-id-123',
      );

      validateSpy.mockRestore();
    });
    it('should create new client and send code if phone not found', async () => {
      const validateSpy = jest
        .spyOn(service, 'validatePhoneNumber')
        .mockReturnValue(normalizedPhone);

      mockPrisma.client.findUnique.mockResolvedValue(null);
      mockPrisma.client.create.mockResolvedValue({
        id: 'new-id',
        phone: normalizedPhone,
      });

      // Важно: requestAuthCode тоже полезет в БД искать старые коды
      mockTx.authMessage.findFirst.mockResolvedValue(null);
      mockTx.authMessage.create.mockResolvedValue(mockAuthMessageRecord);

      await service.sendCode(rawPhone, SendCodeType.UCALLER);

      expect(mockPrisma.client.create).toHaveBeenCalledWith({
        data: { phone: normalizedPhone, name: '' },
      });

      // Проверяем вызов нового метода уведомлений
      expect(notificationService.publishAuthEvent).toHaveBeenCalledWith(
        mockAuthMessageRecord.id,
      );

      validateSpy.mockRestore();
    });
  });

  describe('loginByCode', () => {
    it('should return client after succ5essful code verification', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);

      const checkSpy = jest
        .spyOn(service, 'checkAuthCode')
        .mockResolvedValue(undefined as any);

      const result = await service.loginByCode(mockClient.phone, '1234');

      expect(result).toEqual(mockClient);

      expect(checkSpy).toHaveBeenCalledWith(mockClient.phone, '1234');
    });

    it('should throw NotFoundException if client disappears', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      await expect(service.loginByCode('phone', '1234')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
  describe('findOne', () => {
    it('should return a client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      const result = await service.findOne(mockClient.id);
      expect(result).toEqual(toDto(mockClient, ReadClientDto));
    });

    it('should return AdminReadClientDto if extended is true', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      const result = await service.findOne(mockClient.id, true);
      expect(result).toEqual(toDto(mockClient, AdminReadClientDto));
    });
  });

  describe('findOneByPhone', () => {
    it('should return a client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      const result = await service.findOneByPhone(mockClient.phone);
      const expectedOutput = toDto(mockClient, ReadClientDto);
      expect(result).toEqual(expectedOutput);
    });

    it('should throw an exception if client not found', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      await expect(service.findOneByPhone(mockClient.phone)).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it('should throw bad request exception if not domain exception', async () => {
      const dbError = new Error('Conection refused');
      mockPrisma.client.findUnique.mockRejectedValue(dbError);
      await expect(service.findOneByPhone(mockClient.phone)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
  describe('create', () => {
    it('should create a client', async () => {
      const dto: CreateClientDto = {
        phone: '+79991112233',
      };

      mockPrisma.client.create.mockResolvedValue({
        ...mockClient,
        phone: dto.phone,
      });

      const result = await service.create(dto);

      expect(result.phone).toBe(dto.phone);
      expect(mockPrisma.client.create).toHaveBeenCalledWith({
        data: {
          phone: dto.phone,
        },
      });
    });

    it('should throw PhoneAlreadyExistsException on unique constraint violation', async () => {
      const dto: CreateClientDto = { phone: '+79991112233' };

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.x.x',
          meta: { target: ['phone'], modelName: 'Client' },
        },
      );

      mockPrisma.client.create.mockRejectedValue(prismaError);

      await expect(service.create(dto)).rejects.toThrow(
        PhoneAlreadyExistsException,
      );
    });

    it('should throw original error on any other DB error', async () => {
      const dto: CreateClientDto = { phone: '+70000000000' };
      const dbError = new Error('DB connection lost');
      mockPrisma.client.create.mockRejectedValue(dbError);

      await expect(service.create(dto)).rejects.toThrow('DB connection lost');
    });
  });

  describe('refresh', () => {
    const mockPayload = { sub: '1', phone: '1234567890' };

    it('should generate a new access token when refresh token is valid', async () => {
      (service as any).jwt.verifyAsync.mockResolvedValue(mockPayload);

      mockPrisma.client.findUnique.mockResolvedValue(mockClient);

      jest
        .spyOn(service, 'generateAccessToken')
        .mockResolvedValue('NEW_ACCESS_TOKEN');

      const result = await service.refresh('VALID_REFRESH_TOKEN');

      expect((service as any).jwt.verifyAsync).toHaveBeenCalledWith(
        'VALID_REFRESH_TOKEN',
        {
          secret: (service as any).refreshSecret,
        },
      );

      expect(mockPrisma.client.findUnique).toHaveBeenCalledWith({
        where: { id: mockPayload.sub },
      });

      expect(service.generateAccessToken).toHaveBeenCalledWith(mockClient);
      expect(result).toBe('NEW_ACCESS_TOKEN');
    });

    it('should throw BadRequestException when refresh token is invalid', async () => {
      (service as any).jwt.verifyAsync.mockRejectedValue(
        new Error('JWT expired'),
      );

      await expect(service.refresh('BAD_TOKEN')).rejects.toThrow(
        BadRequestException,
      );

      expect((service as any).logger.warn).toHaveBeenCalled();
    });

    it('should throw NotFoundException when client does not exist in DB', async () => {
      (service as any).jwt.verifyAsync.mockResolvedValue(mockPayload);

      mockPrisma.client.findUnique.mockResolvedValue(null);

      await expect(service.refresh('VALID_REFRESH_TOKEN')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    const clientId = '123';

    it('should successfully soft delete a client', async () => {
      mockPrisma.client.update.mockResolvedValue({
        ...mockClient,
        id: clientId,
        deletedAt: new Date(),
      });

      await service.softDelete(clientId);

      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: clientId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if client does not exist', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'An operation failed because it depends on one or more records that were not found.',
        {
          code: 'P2025',
          clientVersion: '5.x.x',
        },
      );

      mockPrisma.client.update.mockRejectedValue(prismaError);

      await expect(service.softDelete(clientId)).rejects.toThrow(
        NotFoundException,
      );

      expect((service as any).logger.error).toHaveBeenCalled();
    });

    it('should throw original error if it is not a specific Prisma error', async () => {
      const genericError = new Error('Connection lost');
      mockPrisma.client.update.mockRejectedValue(genericError);

      await expect(service.softDelete(clientId)).rejects.toThrow(
        'Connection lost',
      );

      expect((service as any).logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`softDelete() | Error | id=${clientId}`),
        genericError.stack,
      );
    });
  });

  describe('Token Generation', () => {
    describe('generateAccessToken', () => {
      it('should generate an access token with correct payload and options', async () => {
        const token = 'mock-access-token';

        (service as any).jwt.signAsync.mockResolvedValue(token);

        const result = await service.generateAccessToken(mockClient);

        expect((service as any).jwt.signAsync).toHaveBeenCalledWith(
          {
            phone: mockClient.phone,
            sub: mockClient.id,
          },
          {
            expiresIn: 900,
            secret: 'ACCESS_SECRET',
          },
        );
        expect(result).toBe(token);
      });
    });

    describe('generateRefreshToken', () => {
      it('should generate a refresh token with correct payload and options', async () => {
        const token = 'mock-refresh-token';

        (service as any).jwt.signAsync.mockResolvedValue(token);

        const result = await service.generateRefreshToken(mockClient);

        expect((service as any).jwt.signAsync).toHaveBeenCalledWith(
          {
            sub: mockClient.id,
            phone: mockClient.phone,
          },
          {
            expiresIn: 604800,
            secret: 'REFRESH_SECRET',
          },
        );
        expect(result).toBe(token);
      });
    });
  });

  describe('setRefreshCookie', () => {
    it('should set refresh token cookie with correct options', () => {
      const mockRes: any = {
        cookie: jest.fn(),
      };
      const token = 'some-refresh-token';

      service.setRefreshCookie(mockRes, token);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'client_refresh_token',
        token,
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path: '/',
          maxAge: 604800 * 1000,
        }),
      );
    });
  });

  describe('update', () => {
    const clientId = '1';
    const updateDto: UpdateClientDto = { name: 'New Name' };

    it('should successfully update a client and return AdminReadClientDto', async () => {
      const updatedClient = { ...mockClient, name: 'New Name' };
      mockPrisma.client.update.mockResolvedValue(updatedClient);

      const result = await service.update(clientId, updateDto);

      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: clientId },
        data: { ...updateDto },
      });

      expect(result.name).toBe('New Name');
      expect(result).toEqual(toDto(updatedClient, AdminReadClientDto));
    });

    it('should throw NotFoundException if client does not exist (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record to update not found.',
        {
          code: 'P2025',
          clientVersion: '5.x.x',
        },
      );
      mockPrisma.client.update.mockRejectedValue(prismaError);

      await expect(service.update(clientId, updateDto)).rejects.toThrow(
        NotFoundException,
      );

      expect((service as any).logger.error).toHaveBeenCalled();
    });

    it('should throw original error for generic connection issues', async () => {
      const genericError = new Error('Database is down');
      mockPrisma.client.update.mockRejectedValue(genericError);

      await expect(service.update(clientId, updateDto)).rejects.toThrow(
        'Database is down',
      );

      expect((service as any).logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`update() | Database is down`),
        genericError.stack,
      );
    });

    it('should throw PhoneAlreadyExistsException if update violates unique constraint', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.x.x',
          meta: { target: ['phone'], modelName: 'Client' },
        },
      );
      mockPrisma.client.update.mockRejectedValue(prismaError);

      await expect(service.update(clientId, updateDto)).rejects.toThrow(
        PhoneAlreadyExistsException,
      );
    });
  });

  describe('Error Handling (Constraint Violations)', () => {
    it('should throw PhoneAlreadyExistsException when Prisma returns P2002 on Client model', async () => {
      const dto: CreateClientDto = { phone: '12345' };

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.x.x',
          meta: { target: ['phone'], modelName: 'Client' },
        },
      );

      mockPrisma.client.create.mockRejectedValue(prismaError);

      await expect(service.create(dto)).rejects.toThrow(
        PhoneAlreadyExistsException,
      );
    });

    it('should throw BadRequestException for unknown Prisma errors', async () => {
      const dto: CreateClientDto = { phone: '12345' };
      const unknownPrismaError = new Prisma.PrismaClientKnownRequestError(
        'Something went wrong',
        { code: 'P9999', clientVersion: '5.x.x' },
      );

      mockPrisma.client.create.mockRejectedValue(unknownPrismaError);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);

      await expect(service.create(dto)).rejects.toThrow(
        'Database operation failed',
      );
    });
  });

  describe('Auth Logic (AuthMessage)', () => {
    const target = '+79161234567';

    describe('requestAuthCode', () => {
      it('should create a new auth record if no pending code exists', async () => {
        jest.spyOn(service as any, 'findPendingCode').mockResolvedValue(null);
        mockTx.authMessage.create.mockResolvedValue(mockAuthMessageRecord);

        const result = await (service as any).requestAuthCode(
          target,
          SendCodeType.UCALLER,
        );

        expect(mockTx.authMessage.create).toHaveBeenCalled();
        expect(notificationMock.publishAuthEvent).toHaveBeenCalledWith(
          mockAuthMessageRecord.id,
        );
        expect(result).toEqual(mockAuthMessageRecord);
      });

      it('should resend (update) existing code if within limits', async () => {
        const existingCode = {
          ...mockAuthMessageRecord,
          resendCount: 0,
          updatedAt: new Date(Date.now() - 70000),
        };

        jest
          .spyOn(service as any, 'findPendingCode')
          .mockResolvedValue(existingCode);
        mockTx.authMessage.update.mockResolvedValue({
          ...existingCode,
          resendCount: 1,
        });

        await (service as any).requestAuthCode(target, SendCodeType.UCALLER);

        expect(mockTx.authMessage.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: existingCode.id },
            data: expect.objectContaining({ resendCount: { increment: 1 } }),
          }),
        );
      });

      it('should throw ResendTooFastException if resending too quickly', async () => {
        const recentCode = {
          ...mockAuthMessageRecord,
          updatedAt: new Date(),
        };
        jest
          .spyOn(service as any, 'findPendingCode')
          .mockResolvedValue(recentCode);

        await expect(
          (service as any).requestAuthCode(target, SendCodeType.UCALLER),
        ).rejects.toThrow(ResendTooFastException);
      });

      it('should throw ResendLimitExceededException if maxResendCount reached', async () => {
        const exhaustedCode = {
          ...mockAuthMessageRecord,
          resendCount: 3,
          updatedAt: new Date(Date.now() - 70000),
        };
        jest
          .spyOn(service as any, 'findPendingCode')
          .mockResolvedValue(exhaustedCode);

        await expect(
          (service as any).requestAuthCode(target, SendCodeType.UCALLER),
        ).rejects.toThrow(ResendLimitExceededException);
      });
    });

    describe('checkAuthCode', () => {
      it('should verify successfully and set status to VERIFIED', async () => {
        jest
          .spyOn(service as any, 'findPendingCode')
          .mockResolvedValue(mockAuthMessageRecord);

        mockPrisma.authMessage.update.mockResolvedValue({
          ...mockAuthMessageRecord,
          status: 'VERIFIED',
        });

        await service.checkAuthCode(target, mockAuthMessageRecord.code);

        expect(mockPrisma.authMessage.update).toHaveBeenCalledWith({
          where: { id: mockAuthMessageRecord.id },
          data: { status: 'VERIFIED' },
        });
      });

      it('should increment attempts and throw ForbiddenException on wrong code', async () => {
        jest.spyOn(service as any, 'findPendingCode').mockResolvedValue({
          ...mockAuthMessageRecord,
          attemptsCount: 0,
        });

        await expect(
          service.checkAuthCode(target, 'WRONG_CODE'),
        ).rejects.toThrow(ForbiddenException);

        expect(mockPrisma.authMessage.update).toHaveBeenCalledWith({
          where: { id: mockAuthMessageRecord.id },
          data: { attemptsCount: 1, status: 'PENDING' },
        });
      });

      it('should set status to FAILED if max verification attempts reached', async () => {
        jest.spyOn(service as any, 'findPendingCode').mockResolvedValue({
          ...mockAuthMessageRecord,
          attemptsCount: 2,
        });

        await expect(
          service.checkAuthCode(target, 'WRONG_CODE'),
        ).rejects.toThrow(ForbiddenException);

        expect(mockPrisma.authMessage.update).toHaveBeenCalledWith({
          where: { id: mockAuthMessageRecord.id },
          data: { attemptsCount: 3, status: 'FAILED' },
        });
      });
    });
  });
});
