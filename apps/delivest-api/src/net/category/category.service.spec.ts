import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { jest } from '@jest/globals';
import {
  NotFoundException,
  BadRequestException,
} from '../../shared/exception/domain_exception/domain-exception.js';
import { CategoryService } from './category.service.js';

describe('CategoryService (Comprehensive Tests)', () => {
  let service: CategoryService;
  let mockPrisma: any;

  const mockCategory = {
    id: 'cat-123',
    name: 'Пицца',
    branchId: 'branch-999',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const prismaMock = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    mockPrisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAllByBranch', () => {
    const branchId = 'branch-999';

    it('should return regular ReadCategoryDto (no system fields)', async () => {
      mockPrisma.category.findMany.mockResolvedValue([mockCategory]);

      const result = await service.findAllByBranch(branchId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      // В ReadCategoryDto обычно нет createdAt/deletedAt (зависит от вашего toDto)
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        where: { branchId, deletedAt: null },
      });
    });

    it('should return AdminReadCategoryDto when extended is true', async () => {
      mockPrisma.category.findMany.mockResolvedValue([mockCategory]);

      const result = await service.findAllByBranch(branchId, true);

      expect(result[0]).toHaveProperty('createdAt');
      expect(result[0]).toHaveProperty('updatedAt');
    });

    it('should throw NotFoundException if result array is empty', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);
      await expect(service.findAllByBranch(branchId)).rejects.toThrow(NotFoundException);
    });

    it('should catch unknown DB errors and throw BadRequestException', async () => {
      mockPrisma.category.findMany.mockRejectedValue(new Error('Fatal DB Error'));
      await expect(service.findAllByBranch(branchId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    const catId = 'cat-123';

    it('should find a single category by id', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findOne(catId);

      expect(result.id).toBe(catId);
      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: catId },
      });
    });

    it('should return admin-level data when requested', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);
      const result = await service.findOne(catId, true);
      expect(result).toHaveProperty('deletedAt');
    });

    it('should throw NotFoundException if category is null', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne(catId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'Десерты',
      branchId: 'branch-999',
      order: 5,
    };

    it('should successfully create a category and return Admin DTO', async () => {
      mockPrisma.category.create.mockResolvedValue({
        ...mockCategory,
        ...createDto,
        id: 'new-id',
      });

      const result = await service.create(createDto);

      expect(result.id).toBe('new-id');
      expect(result.name).toBe('Десерты');
      expect(mockPrisma.category.create).toHaveBeenCalledWith({
        data: createDto,
      });
    });

    it('should fail if prisma.create fails', async () => {
      mockPrisma.category.create.mockRejectedValue(new Error('Unique name error'));
      await expect(service.create(createDto)).rejects.toThrow();
    });
  });

  describe('update', () => {
    const catId = 'cat-123';
    const updateDto = { name: 'Обновленная Пицца', order: 10 };

    it('should update specific fields and return updated category', async () => {
      mockPrisma.category.update.mockResolvedValue({
        ...mockCategory,
        ...updateDto,
      });

      const result = await service.update(catId, updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(result.order).toBe(updateDto.order);
      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: catId },
        data: updateDto,
      });
    });

    it('should throw exception if update fails (e.g. record not found)', async () => {
      mockPrisma.category.update.mockRejectedValue(new Error('P2025')); 
      await expect(service.update(catId, updateDto)).rejects.toThrow();
    });
  });

  describe('softDelete', () => {
    const catId = 'cat-123';

    it('should set deletedAt field to current date', async () => {
      mockPrisma.category.update.mockResolvedValue({
        ...mockCategory,
        deletedAt: new Date(),
      });

      await service.softDelete(catId);

      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: catId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should log an error and throw if delete fails', async () => {
      mockPrisma.category.update.mockRejectedValue(new Error('Delete error'));
      await expect(service.softDelete(catId)).rejects.toThrow();
    });
  });
});