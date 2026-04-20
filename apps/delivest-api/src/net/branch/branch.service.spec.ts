import { Test, TestingModule } from '@nestjs/testing';
import { BranchService } from './branch.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { jest } from '@jest/globals';

describe('BranchService', () => {
  let service: BranchService;
  let mockPrisma: any;

  const branchId = '123';

  const mockBranch = {
    id: branchId,
    name: 'Main Branch',
    alias: 'main-branch',
    deletedAt: null,
  };

  const mockInfo = {
    id: 'info_1',
    branchId: branchId,
    address: 'Street 1',
    description: 'Description',
  };

  const mockBranchWithInfo = {
    ...mockBranch,
    info: mockInfo,
  };

  beforeEach(async () => {
    const prismaMock = {
      branch: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      branchInfo: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<BranchService>(BranchService);
    mockPrisma = module.get(PrismaService);
  });

  describe('findAll', () => {
    it('should return all active branches', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([mockBranch]);

      const result = await service.findAll();

      expect(mockPrisma.branch.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(branchId);
    });

    it('should return extended dto when extended is true', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([mockBranch]);

      const result = await service.findAll(true);

      expect(result).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should return a single branch with info', async () => {
      const branchId = '123';
      const expectedBranch = {
        id: branchId,
        name: 'Test Branch',
        alias: 'test',
      };

      mockPrisma.branch.findUnique.mockResolvedValue(expectedBranch);

      const result = await service.findOne(branchId);

      expect(mockPrisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: branchId, deletedAt: null },
      });
      expect(result).toEqual(expectedBranch);
    });
  });

  describe('create', () => {
    it('should create branch and empty info record', async () => {
      const createDto = { name: 'New', alias: 'new' };
      const expectedBranch = { id: '456', ...createDto };

      mockPrisma.branch.create.mockResolvedValue(expectedBranch);

      const result = await service.create(createDto);

      expect(mockPrisma.branch.create).toHaveBeenCalledWith({
        data: { ...createDto },
      });
      expect(result).toEqual(expectedBranch);
    });
  });

  describe('update', () => {
    it('should update branch main fields', async () => {
      const branchId = '123';
      const updateDto = { name: 'Updated Name' };
      const expectedBranch = { id: branchId, ...updateDto, alias: 'test' };

      mockPrisma.branch.update.mockResolvedValue(expectedBranch);

      const result = await service.update(branchId, updateDto);

      expect(mockPrisma.branch.update).toHaveBeenCalledWith({
        where: { id: branchId },
        data: updateDto,
      });
      expect(result).toEqual(expectedBranch);
    });
  });

  describe('softDelete', () => {
    it('should update deletedAt field with current date', async () => {
      mockPrisma.branch.update.mockResolvedValue({
        ...mockBranch,
        deletedAt: new Date(),
      });

      await service.softDelete(branchId);

      expect(mockPrisma.branch.update).toHaveBeenCalledWith({
        where: { id: branchId },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
