import { jest } from '@jest/globals';

jest.unstable_mockModule('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

const argon2 = await import('argon2');

import { PrismaService } from '../../prisma/prisma.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { Client, Prisma } from '../../../generated/prisma/client.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadClientDto } from './dto/read.dto.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import {
  BadRequestException,
  InvalidCredentialsException,
  NotFoundException,
  PhoneAlreadyExistsException,
  RegistrationFailedException,
  UserNotFoundException,
  UserNotRegisteredException,
} from '../../shared/exception/domain_exception/domain-exception.js';

import { CreateClientDto } from './dto/create.dto.js';
import { ForbiddenException } from '@nestjs/common/exceptions/index.js';

import type { ClientService as ClientServiceType } from './client.service.js';
import { AdminReadClientDto } from './dto/admin-read.dto.js';
import { UpdateClientDto } from './dto/update.dto.js';

describe('ClientService', () => {
  let service: ClientServiceType;
  let mockPrisma: any;

  const mockArgonVerify = argon2.verify as unknown as jest.MockedFunction<
    typeof argon2.verify
  >;
  const mockArgonHash = argon2.hash as unknown as jest.MockedFunction<
    typeof argon2.hash
  >;

  const mockClient: Client = {
    id: '1',
    name: 'John Doe',
    phone: '1234567890',
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: 'hashedpassword',
    deletedAt: null,
  };

  const mockGetUserDto = { id: '1' };

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
              return config[key as keyof typeof config] || null;
            }),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ClientServiceType>(ClientService);
    mockPrisma = module.get(PrismaService);

    // Глушим логгеры
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
  });
  describe('findOne', () => {
    it('should return a client', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      const result = await service.findOne(mockGetUserDto.id);
      const expectedOutput = toDto(mockClient, ReadClientDto);
      expect(result).toEqual(expectedOutput);
    });

    it('should throw an exception if client not found', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);
      await expect(service.findOne(mockGetUserDto.id)).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it('should throw bad request exception if not domain exception', async () => {
      const dbError = new Error('Conection refused');
      mockPrisma.client.findUnique.mockRejectedValue(dbError);
      await expect(service.findOne(mockGetUserDto.id)).rejects.toThrow(
        BadRequestException,
      );
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
    it('should create a client with password hash', async () => {
      const dto: CreateClientDto = {
        phone: '+79991112233',
        password: 'securePassword123',
      };
      mockArgonHash.mockResolvedValue('argon_hash');

      mockPrisma.client.create.mockResolvedValue({
        ...mockClient,
        phone: dto.phone,
        passwordHash: 'argon_hash',
      });

      const result = await service.create(dto);

      expect(result.phone).toBe(dto.phone);
      expect(mockPrisma.client.create).toHaveBeenCalledWith({
        data: {
          phone: dto.phone,
          passwordHash: expect.any(String),
        },
      });
    });

    it('should create a client without password (passwordHash = null)', async () => {
      const dto: CreateClientDto = { phone: '+79991112233' };

      mockPrisma.client.create.mockResolvedValue({
        ...mockClient,
        phone: dto.phone,
        passwordHash: null,
      });

      const result = await service.create(dto);

      expect(result.passwordHash).toBeNull();
      expect(mockPrisma.client.create).toHaveBeenCalledWith({
        data: {
          phone: dto.phone,
          passwordHash: null,
        },
      });
    });

    it('should throw PhoneAlreadyExistsException on unique constraint violation', async () => {
      const dto: CreateClientDto = { phone: '+79991112233', password: '123' };

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

  describe('changePassword', () => {
    const changePasswordDto = {
      oldPassword: 'old-password',
      newPassword: 'new-password-123',
    };

    it('should successfully change password', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockArgonVerify.mockResolvedValue(true);
      mockArgonHash.mockResolvedValue('new-hashed-password');

      await service.changePassword(mockClient.id, changePasswordDto);

      expect(mockArgonVerify).toHaveBeenCalledWith(
        mockClient.passwordHash,
        changePasswordDto.oldPassword,
      );
      expect(mockArgonHash).toHaveBeenCalledWith(changePasswordDto.newPassword);
      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: mockClient.id },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('should throw ForbiddenException if old password is invalid', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockArgonVerify.mockResolvedValue(false);

      await expect(
        service.changePassword(mockClient.id, changePasswordDto),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.client.update).not.toHaveBeenCalled();
    });

    it('should throw UserNotRegisteredException if passwordHash is missing', async () => {
      const clientWithoutHash = { ...mockClient, passwordHash: null };
      mockPrisma.client.findUnique.mockResolvedValue(clientWithoutHash);

      await expect(
        service.changePassword(mockClient.id, changePasswordDto),
      ).rejects.toThrow(UserNotRegisteredException);
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

  describe('validateCredentials', () => {
    const loginDto = {
      phone: '1234567890',
      password: 'correct-password',
    };

    it('should return client on valid credentials', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockArgonVerify.mockResolvedValue(true);

      const result = await service.validateCredentials(loginDto);

      expect(mockPrisma.client.findUnique).toHaveBeenCalledWith({
        where: { phone: loginDto.phone },
      });
      expect(mockArgonVerify).toHaveBeenCalledWith(
        mockClient.passwordHash,
        loginDto.password,
      );
      expect(result).toEqual(mockClient);
    });

    it('should throw NotFoundException if client does not exist', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);

      await expect(service.validateCredentials(loginDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UserNotRegisteredException if client has no passwordHash', async () => {
      const clientWithoutHash = { ...mockClient, passwordHash: null };
      mockPrisma.client.findUnique.mockResolvedValue(clientWithoutHash);

      await expect(service.validateCredentials(loginDto)).rejects.toThrow(
        UserNotRegisteredException,
      );
    });

    it('should throw InvalidCredentialsException if password is incorrect', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(mockClient);
      mockArgonVerify.mockResolvedValue(false);

      await expect(service.validateCredentials(loginDto)).rejects.toThrow(
        InvalidCredentialsException,
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
      const dto: CreateClientDto = { phone: '12345', password: 'password' };

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
});
