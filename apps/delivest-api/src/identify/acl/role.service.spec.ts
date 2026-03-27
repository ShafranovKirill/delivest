import { Test, TestingModule } from '@nestjs/testing';
import { RoleService } from './role.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { jest } from '@jest/globals';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  NotFoundException,
  DuplicateValueException,
  BadRequestException,
} from '../../shared/exception/domain_exception/domain-exception.js';
import { Permission } from '../../../generated/prisma/enums.js';

describe('RoleService', () => {
  let service: RoleService;
  let mockPrisma: any;

  const mockRole = {
    id: 'role-1',
    name: 'Admin',
    permissions: [Permission.STAFF_CREATE, Permission.STAFF_READ],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const prismaMock = {
      role: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
    mockPrisma = module.get(PrismaService);

    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
  });

  describe('findById', () => {
    it('should return a role if found', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      const result = await service.findById('role-1');
      expect(result.name).toBe(mockRole.name);
      expect(mockPrisma.role.findUnique).toHaveBeenCalledWith({
        where: { id: 'role-1' },
      });
    });

    it('should throw NotFoundException if role not found', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);
      await expect(service.findById('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of roles', async () => {
      mockPrisma.role.findMany.mockResolvedValue([mockRole]);
      const result = await service.findAll();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].name).toBe('Admin');
    });

    it('should throw BadRequestException on generic DB error', async () => {
      mockPrisma.role.findMany.mockRejectedValue(
        new Error('DB connection lost'),
      );
      await expect(service.findAll()).rejects.toThrow('Failed to fetch staff');
    });
  });

  describe('create', () => {
    it('should successfully create a role with permissions', async () => {
      const dto = { name: 'Manager', permissions: [Permission.STAFF_READ] };
      mockPrisma.role.create.mockResolvedValue({
        ...mockRole,
        ...dto,
        id: 'role-2',
      });

      const result = await service.create(dto);

      expect(result.name).toBe('Manager');
      expect(mockPrisma.role.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          permissions: dto.permissions,
        },
      });
    });

    it('should throw DuplicateValueException if role name exists (P2002)', async () => {
      const dto = { name: 'Admin', permissions: [] };
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        {
          code: 'P2002',
          clientVersion: '5.x',
          meta: { target: ['name'] },
        },
      );
      mockPrisma.role.create.mockRejectedValue(prismaError);

      await expect(service.create(dto)).rejects.toThrow(
        DuplicateValueException,
      );
    });
  });

  describe('update', () => {
    it('should update role data', async () => {
      const dto = { name: 'SuperAdmin' };
      mockPrisma.role.update.mockResolvedValue({
        ...mockRole,
        name: 'SuperAdmin',
      });

      const result = await service.update('role-1', dto);

      expect(result.name).toBe('SuperAdmin');
      expect(mockPrisma.role.update).toHaveBeenCalledWith({
        where: { id: 'role-1' },
        data: { ...dto },
      });
    });

    it('should throw NotFoundException if record to update not found (P2025)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Not found',
        {
          code: 'P2025',
          clientVersion: '5.x',
        },
      );
      mockPrisma.role.update.mockRejectedValue(prismaError);

      await expect(
        service.update('wrong-id', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt date', async () => {
      mockPrisma.role.update.mockResolvedValue({
        ...mockRole,
        deletedAt: new Date(),
      });

      await service.softDelete('role-1');

      expect(mockPrisma.role.update).toHaveBeenCalledWith({
        where: { id: 'role-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('handleRoleConstraintError', () => {
    it('should rethrow original error if it is not a Prisma error', async () => {
      const genericError = new Error('Some system error');
      mockPrisma.role.update.mockRejectedValue(genericError);

      await expect(service.update('1', { name: 'n' })).rejects.toThrow(
        'Some system error',
      );
    });

    it('should throw BadRequestException for unknown Prisma codes', async () => {
      const unknownPrismaError = new Prisma.PrismaClientKnownRequestError(
        'Unknown',
        {
          code: 'P9999',
          clientVersion: '5.x',
        },
      );
      mockPrisma.role.update.mockRejectedValue(unknownPrismaError);

      await expect(service.update('1', { name: 'n' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
