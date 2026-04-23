import { jest } from '@jest/globals';

// Мокаем argon2 до импортов, как в исходном примере
jest.unstable_mockModule('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

const argon2 = await import('argon2');

import { PrismaService } from '../../prisma/prisma.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { Staff, Prisma } from '../../../generated/prisma/client.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadStaffDto } from './dto/read.dto.js';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleService } from '../acl/role.service.js';

import {
  BadRequestException,
  InvalidCredentialsException,
  NotFoundException,
  UserAlreadyExistsException,
  RegistrationFailedException,
  UserNotFoundException,
  UserNotRegisteredException,
} from '../../shared/exceptions/domain_exception/domain-exception.js';

import { CreateStaffDto } from './dto/create.dto.js';
import { ForbiddenException } from '@nestjs/common/exceptions/index.js';

import type { StaffService as StaffServiceType } from './staff.service.js';

describe('StaffService', () => {
  let service: StaffServiceType;
  let mockPrisma: any;
  let mockRoleService: any;

  const mockArgonVerify = argon2.verify as unknown as jest.MockedFunction<
    typeof argon2.verify
  >;
  const mockArgonHash = argon2.hash as unknown as jest.MockedFunction<
    typeof argon2.hash
  >;

  const mockStaff: Staff = {
    id: 'staff-1',
    login: 'admin_user',
    passwordHash: 'hashed_password',
    roleId: 'role-uuid',
    name: 'Admin User',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockStaffWithBranches = {
    ...mockStaff,
    branches: [{ branchId: 'branch-1' }, { branchId: 'branch-2' }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const { StaffService } = await import('./staff.service.js');

    const prismaMock = {
      staff: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      staffBranch: {
        findMany: jest.fn(),
      },
    };

    const roleServiceMock = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RoleService, useValue: roleServiceMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JWT_ACCESS_TTL_SECONDS_STAFF: 900,
                JWT_REFRESH_TTL_SECONDS_STAFF: 604800,
                JWT_ACCESS_SECRET_STAFF: 'ACCESS_SECRET_STAFF',
                JWT_REFRESH_SECRET_STAFF: 'REFRESH_SECRET_STAFF',
                NODE_ENV: 'test',
                COOKIE_DOMAIN: 'localhost',
              };
              return config[key as keyof typeof config] || null;
            }),
            getOrThrow: jest.fn((key: string) => {
              const config = {
                JWT_ACCESS_TTL_SECONDS_STAFF: 900,
                JWT_REFRESH_TTL_SECONDS_STAFF: 604800,
                JWT_ACCESS_SECRET_STAFF: 'ACCESS_SECRET_STAFF',
                JWT_REFRESH_SECRET_STAFF: 'REFRESH_SECRET_STAFF',
                NODE_ENV: 'test',
                COOKIE_DOMAIN: 'localhost',
              };
              const value = config[key as keyof typeof config];
              if (value === undefined) {
                throw new Error(`Configuration key "${key}" does not exist`);
              }
              return value;
            }),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StaffServiceType>(StaffService);
    mockPrisma = module.get(PrismaService);
    mockRoleService = module.get(RoleService);

    // Глушим логгеры
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
  });

  describe('findOne', () => {
    it('should throw UserNotFoundException if staff not found', async () => {
      mockPrisma.staff.findUnique.mockResolvedValue(null);
      await expect(service.findOne('invalid')).rejects.toThrow(
        UserNotFoundException,
      );
    });
  });

  describe('findOneByLogin', () => {
    it('should return staff by login', async () => {
      mockPrisma.staff.findUnique.mockResolvedValue(
        mockStaffWithBranches as any,
      );
      const result = await service.findOneByLogin(mockStaff.login);
      expect(result.id).toBe(mockStaff.id);
      expect(result.login).toBe(mockStaff.login);
      expect(result.branchIds).toEqual(['branch-1', 'branch-2']);
    });

    it('should throw UserNotFoundException if login not found', async () => {
      mockPrisma.staff.findUnique.mockResolvedValue(null);
      await expect(service.findOneByLogin('ghost')).rejects.toThrow(
        UserNotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of staff members with branchIds', async () => {
      const mockStaffList = [
        { ...mockStaffWithBranches, id: '1' },
        { ...mockStaffWithBranches, id: '2', login: 'manager' },
      ];
      mockPrisma.staff.findMany.mockResolvedValue(mockStaffList as any);

      const result = await service.findAll();

      expect(mockPrisma.staff.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: { branches: true },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].branchIds).toEqual(['branch-1', 'branch-2']);
      expect(result[1].id).toBe('2');
      expect(result[1].branchIds).toEqual(['branch-1', 'branch-2']);
    });
  });

  describe('create', () => {
    const createDto: CreateStaffDto = {
      login: 'new_staff',
      password: 'password123',
      roleId: 'role-id',
      name: 'New Staff Member',
      branchIds: ['branch-1', 'branch-2'],
    };

    it('should hash password and create staff', async () => {
      mockArgonHash.mockResolvedValue('new_hash');
      mockPrisma.staff.create.mockResolvedValue({
        ...mockStaff,
        ...createDto,
        passwordHash: 'new_hash',
      });

      const result = await service.create(createDto);

      expect(mockArgonHash).toHaveBeenCalledWith(createDto.password);
      expect(mockPrisma.staff.create).toHaveBeenCalledWith({
        data: {
          login: createDto.login,
          passwordHash: 'new_hash',
          roleId: createDto.roleId,
          name: createDto.name,
          branches: {
            createMany: {
              data: createDto.branchIds.map((branchId) => ({ branchId })),
            },
          },
        },
        include: { branches: true },
      });
      expect(result.login).toBe(createDto.login);
    });

    it('should throw UserAlreadyExistsException on unique violation', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('', {
        code: 'P2002',
        clientVersion: '5.x',
        meta: { modelName: 'Staff' },
      });
      mockPrisma.staff.create.mockRejectedValue(prismaError);

      await expect(service.create(createDto)).rejects.toThrow(
        UserAlreadyExistsException,
      );
    });
  });

  describe('validateCredentials', () => {
    const loginDto = { login: 'admin', password: 'password' };

    it('should return staff on valid credentials', async () => {
      mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
      mockArgonVerify.mockResolvedValue(true);

      const result = await service.validateCredentials(loginDto);
      expect(result).toEqual(mockStaff);
    });

    it('should throw InvalidCredentialsException on wrong password', async () => {
      mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
      mockArgonVerify.mockResolvedValue(false);

      await expect(service.validateCredentials(loginDto)).rejects.toThrow(
        InvalidCredentialsException,
      );
    });
  });

  describe('Token Generation', () => {
    it('should generate access token with role permissions', async () => {
      const mockRole = { id: 'role-uuid', permissions: ['READ_ALL'] };
      mockRoleService.findById.mockResolvedValue(mockRole);
      mockPrisma.staffBranch.findMany.mockResolvedValue([
        { branchId: 'branch-1' },
      ]);
      (service as any).jwt.signAsync.mockResolvedValue('access_token');

      const token = await service.generateAccessToken(mockStaff);

      expect(mockRoleService.findById).toHaveBeenCalledWith(mockStaff.roleId);
      expect(mockPrisma.staffBranch.findMany).toHaveBeenCalledWith({
        where: { staffId: mockStaff.id },
        select: { branchId: true },
      });
      expect((service as any).jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: mockRole.permissions,
          sub: mockStaff.id,
          branchIds: ['branch-1'],
        }),
        expect.objectContaining({ secret: 'ACCESS_SECRET_STAFF' }),
      );
      expect(token).toBe('access_token');
    });
  });

  describe('softDelete', () => {
    it('should update deletedAt field', async () => {
      mockPrisma.staff.update.mockResolvedValue(mockStaff);

      await service.softDelete(mockStaff.id);

      expect(mockPrisma.staff.update).toHaveBeenCalledWith({
        where: { id: mockStaff.id },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException if record not found (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('', {
        code: 'P2025',
        clientVersion: '5.x',
      });
      mockPrisma.staff.update.mockRejectedValue(prismaError);

      await expect(service.softDelete('none')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setRefreshCookie', () => {
    it('should set cookie with staff name', () => {
      const mockRes: any = { cookie: jest.fn() };
      service.setRefreshCookie(mockRes, 'token123');

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'staff_refresh_token',
        'token123',
        expect.any(Object),
      );
    });
  });
});
