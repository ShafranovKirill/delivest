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
import { PhotoEditorService } from '../../media/photo-queue/photo-editor.service.js';
import { MediaService } from '../../media/media.service.js';
import { NotificationGateway } from '../../notification/notification.gateway.js';
import { IdentityService } from '../../identify/identify.service.js';
import { TransactionHost } from '@nestjs-cls/transactional';
import * as DbErrors from '../../shared/helpers/db-errors.js';

jest.mock('../../shared/helpers/db-errors.js', () => ({
  isPrismaError: jest.fn(),
  getInternalErrorCode: jest.fn(),
  getPrismaModelName: jest.fn(),
}));

jest.mock('@nestjs-cls/transactional', () => ({
  ...(jest.requireActual('@nestjs-cls/transactional') as any),
  Transactional:
    () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

import {
  isPrismaError,
  getInternalErrorCode,
  getPrismaModelName,
} from '../../shared/helpers/db-errors.js';

describe('ProductService (Extended Tests)', () => {
  let service: ProductService;
  let mockPrisma: any;
  let mockPhotoEditor: any;
  let mockMediaService: any;
  let mockNotificationGateway: any;
  let mockIdentityService: any;
  let mockTxHost: any;

  const mockProduct = {
    id: 'prod-123',
    name: 'Маргарита',
    price: 500,
    branchId: 'branch-999',
    categoryId: 'cat-001',
    deletedAt: null,
  };

  beforeEach(async () => {
    mockPhotoEditor = {
      uploadAndEditMultiple: jest.fn(),
    };

    mockMediaService = {
      deleteFilesByKeys: jest.fn(),
    };

    mockNotificationGateway = {
      server: {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      },
    };

    mockIdentityService = {
      checkBranchAbility: jest.fn(),
    };

    mockTxHost = {
      tx: {
        product: {
          update: jest.fn(),
        },
      },
      withTransaction: jest.fn().mockImplementation(async (...args: any[]) => {
        const callback = args.find((arg) => typeof arg === 'function');
        if (callback) return await callback();
      }),
    };

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
        { provide: PhotoEditorService, useValue: mockPhotoEditor },
        { provide: MediaService, useValue: mockMediaService },
        { provide: NotificationGateway, useValue: mockNotificationGateway },
        { provide: IdentityService, useValue: mockIdentityService },
        { provide: TransactionHost, useValue: mockTxHost },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    mockPrisma = module.get(PrismaService);

    // Mock TransactionHost.getInstance to return our mock
    jest.spyOn(TransactionHost, 'getInstance').mockReturnValue(mockTxHost);

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
      const updateDto: UpdateProductDto = {
        productId: mockProduct.id,
        price: 700,
      };
      mockTxHost.tx.product.update.mockResolvedValue({
        ...mockProduct,
        price: 700,
      });

      const result = await service.update(updateDto);

      expect(result.price).toBe(700);
      expect(mockTxHost.tx.product.update).toHaveBeenCalledWith({
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
