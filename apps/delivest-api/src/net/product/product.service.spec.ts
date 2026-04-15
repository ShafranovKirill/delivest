import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { jest } from '@jest/globals';
import {
  NotFoundException,
  BadRequestException,
  DuplicateValueException,
} from '../../shared/exceptions/domain_exception/domain-exception.js';
import { ProductService } from './product.service.js';
import { CreateProductDto } from './dto/create.dto.js';
import { UpdateProductDto } from './dto/update.dto.js';
import { PrismaErrorCode } from '@delivest/common';
import * as DbErrors from '../../shared/helpers/db-errors.js';

jest.mock('../../shared/helpers/db-errors.js', () => ({
  isPrismaError: jest.fn(),
  getInternalErrorCode: jest.fn(),
  getPrismaModelName: jest.fn(),
}));

import {
  isPrismaError,
  getInternalErrorCode,
  getPrismaModelName,
} from '../../shared/helpers/db-errors.js';

describe('ProductService (Extended Tests)', () => {
  let service: ProductService;
  let mockPrisma: any;

  const mockProduct = {
    id: 'prod-123',
    name: 'Маргарита',
    price: 500,
    branchId: 'branch-999',
    categoryId: 'cat-001',
    deletedAt: null,
  };

  beforeEach(async () => {
    const prismaMock = {
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    mockPrisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAllByCategory', () => {
    it('should return products for a specific category', async () => {
      const catId = 'cat-001';
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findAllByCategory(catId);

      expect(result).toHaveLength(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: { categoryId: catId, deletedAt: null },
      });
    });
  });

  describe('create', () => {
    it('should create and return a new product', async () => {
      const createDto: CreateProductDto = {
        name: 'Пепперони',
        price: 600,
        branchId: 'branch-999',
        categoryId: 'cat-001',
      } as any;

      mockPrisma.product.create.mockResolvedValue({
        ...mockProduct,
        ...createDto,
      });

      const result = await service.create(createDto);

      expect(result.name).toBe('Пепперони');
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: createDto,
      });
    });
  });

  describe('findAllByBranch', () => {
    const branchId = 'branch-999';

    it('should return regular DTOs by default', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findAllByBranch(branchId);

      expect(result[0]).not.toHaveProperty('deletedAt');
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: { branchId, deletedAt: null },
      });
    });

    it('should return admin DTOs when extended is true', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findAllByBranch(branchId, true);

      expect(result).toBeDefined();
      expect(mockPrisma.product.findMany).toHaveBeenCalled();
    });

    it('should return an empty array if nothing found', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      const result = await service.findAllByBranch(branchId);
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    const productId = 'prod-123';

    it('should throw NotFoundException if product is missing', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne(productId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return product if it exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne(productId);

      expect(result.id).toBe(productId);
      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
      });
    });
  });

  describe('findByName', () => {
    const branchId = 'branch-999';
    const searchName = 'пицца';

    it('should call prisma with correct case-insensitive search filters', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);

      await service.findByName(branchId, searchName);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          branchId,
          name: {
            contains: searchName,
            mode: 'insensitive',
          },
          deletedAt: null,
        },
      });
    });
  });

  describe('findAllByCategory', () => {
    const catId = 'cat-001';

    it('should filter by categoryId and active products only', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);

      await service.findAllByCategory(catId);

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          categoryId: catId,
          deletedAt: null,
        },
      });
    });
  });
  describe('update', () => {
    it('should update product data', async () => {
      const updateDto: UpdateProductDto = { price: 700 };
      mockPrisma.product.update.mockResolvedValue({
        ...mockProduct,
        price: 700,
      });

      const result = await service.update(mockProduct.id, updateDto);

      expect(result.price).toBe(700);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: mockProduct.id },
        data: updateDto,
      });
    });
  });

  describe('Extended Mode (Admin DTO)', () => {
    it('should call findOne with extended flag and handle it', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne(mockProduct.id, true);

      expect(result).toBeDefined();
      expect(mockPrisma.product.findUnique).toHaveBeenCalled();
    });
  });
});
