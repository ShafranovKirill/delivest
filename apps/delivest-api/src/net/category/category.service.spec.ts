import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { jest } from '@jest/globals';
import { Category } from '../../../generated/prisma/client.js';
import {
  BadRequestException,
  NotFoundException,
} from '../../shared/exception/domain_exception/domain-exception.js';
import { CategoryService } from './category.service.js';
import { ReadCategoryDto } from './dto/read-category.dto.js';

describe('CategoryService', () => {
  let service: CategoryService;
  let mockPrisma: any;

  const mockCategory: Category = {
    id: 'cat-123',
    name: 'Пицца',
    branchId: 'branch-999',
  } as Category;

  beforeEach(async () => {
    const prismaMock = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    mockPrisma = module.get(PrismaService);
  });

  describe('findAllByBranch', () => {
    const branchId = 'branch-999';

    it('should return categories for a branch', async () => {
      const mockCategories = [mockCategory];
      mockPrisma.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAllByBranch(branchId);

      expect(result[0].id).toEqual(mockCategory.id);
      expect(result[0].name).toEqual(mockCategory.name);
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        where: { branchId },
      });
    });

    it('should throw NotFoundException if no categories found', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);
      await expect(service.findAllByBranch(branchId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on database error', async () => {
      mockPrisma.category.findMany.mockRejectedValue(new Error('DB Error'));
      await expect(service.findAllByBranch(branchId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    const categoryId = 'cat-123';

    it('should return a single category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findOne(categoryId);

      expect(result.id).toEqual(categoryId);
      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: categoryId },
      });
    });

    it('should throw NotFoundException if category does not exist', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne(categoryId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on database error', async () => {
      mockPrisma.category.findUnique.mockRejectedValue(new Error('DB Error'));
      await expect(service.findOne(categoryId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
