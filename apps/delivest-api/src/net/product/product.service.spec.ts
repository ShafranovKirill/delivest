import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { jest } from '@jest/globals';
import {
  BadRequestException,
  NotFoundException,
} from '../../shared/exception/domain_exception/domain-exception.js';
import { ProductService } from './product.service.js';
import { Product } from '../../../generated/prisma/client.js';
import { Decimal } from '@prisma/client/runtime/client';

describe('ProductService', () => {
  let service: ProductService;
  let mockPrisma: any;

  const mockProduct: Product = {
    id: 'prod-123',
    name: 'Маргарита',
    price: new Decimal(500.0),
    isActive: true,
    branchId: 'branch-999',
    categoryId: 'cat-001',
  } as Product;

  const expectedDto = {
    id: mockProduct.id,
    name: mockProduct.name,
  };

  beforeEach(async () => {
    const prismaMock = {
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    mockPrisma = module.get(PrismaService);
  });

  describe('findAllByBranch', () => {
    const branchId = 'branch-999';

    it('should return exactly the mapped products', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      const result = await service.findAllByBranch(branchId);
      expect(result).toEqual([expect.objectContaining(expectedDto)]);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: { branchId },
      });
    });

    it('should throw NotFoundException on empty array', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      await expect(service.findAllByBranch(branchId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on DB failure', async () => {
      mockPrisma.product.findMany.mockRejectedValue(new Error('DB error'));
      await expect(service.findAllByBranch(branchId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAllByCategory', () => {
    const categoryId = 'cat-001';

    it('should return mapped products by category', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      const result = await service.findAllByCategory(categoryId);
      expect(result).toEqual([expect.objectContaining(expectedDto)]);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: { categoryId },
      });
    });

    it('should throw NotFoundException if category is empty', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      await expect(service.findAllByCategory(categoryId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on DB failure', async () => {
      mockPrisma.product.findMany.mockRejectedValue(new Error('DB error'));
      await expect(service.findAllByCategory(categoryId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByName', () => {
    const branchId = 'branch-999';
    const name = 'Марг';

    it('should perform strict substring search', async () => {
      mockPrisma.product.findMany.mockResolvedValue([mockProduct]);
      const result = await service.findByName(branchId, name);
      expect(result[0]).toEqual(expect.objectContaining(expectedDto));
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {
          branchId,
          name: { contains: name },
        },
      });
    });

    it('should throw NotFoundException on no matches', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      await expect(service.findByName(branchId, name)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if search query fails', async () => {
      mockPrisma.product.findMany.mockRejectedValue(new Error('DB error'));
      await expect(service.findByName(branchId, name)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    const productId = 'prod-123';

    it('should return the specific product DTO', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      const result = await service.findOne(productId);
      expect(result).toEqual(expect.objectContaining(expectedDto));
      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
      });
    });

    it('should throw NotFoundException if null is returned', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne(productId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on DB failure', async () => {
      mockPrisma.product.findUnique.mockRejectedValue(new Error('DB error'));
      await expect(service.findOne(productId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
