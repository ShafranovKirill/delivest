import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';
import { jest } from '@jest/globals';
import { GetProductDto } from './dto/find.dto.js';
import { ReadProductDto } from './dto/read.dto.js';
import { FindProductsByNameDto } from './dto/find-by-name.dto.js';
import { GetProductsByCategoryDto } from './dto/find-by-category.dto.js';
import { GetProductsByBranchDto } from './dto/find-by-branch.dto.js';
import { AdminReadProductDto } from './dto/admin-read.dto.js';

describe('ProductController', () => {
  let controller: ProductController;
  let service: jest.Mocked<ProductService>;

  const mockProductService = {
    findAllByBranch: jest.fn(),
    findAllByCategory: jest.fn(),
    findOne: jest.fn(),
    findByName: jest.fn(),
  };

  const mockResult = {
    id: 'prod-123',
    name: 'Маргарита',
    order: 1,
    price: 500,
    branchId: 'branch-999',
    categoryId: 'cat-001',
    photo: null,
    photos: {
      product_card: 'card-key',
      product_preview: 'preview-key',
      product_original: 'original-key',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: ProductService,
          useValue: mockProductService,
        },
      ],
    }).compile();

    controller = module.get<ProductController>(ProductController);
    service = module.get(ProductService) as jest.Mocked<ProductService>;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllProductsByBranch', () => {
    it('should call service.findAllByBranch and return results', async () => {
      const dto: GetProductsByBranchDto = { branchId: 'branch-999' };
      const mockResults = [mockResult];
      service.findAllByBranch.mockResolvedValue(mockResults);

      const result = await controller.getAllProductsByBranch(dto);

      expect(service.findAllByBranch).toHaveBeenCalledWith(dto.branchId);
      expect(result).toEqual(mockResults);
    });
  });

  describe('getAllProductsByCategory', () => {
    it('should call service.findAllByCategory and return results', async () => {
      const dto: GetProductsByCategoryDto = { categoryId: 'cat-001' };
      const mockResults = [mockResult];
      service.findAllByCategory.mockResolvedValue(mockResults);

      const result = await controller.getAllProductsByCategory(dto);

      expect(service.findAllByCategory).toHaveBeenCalledWith(dto.categoryId);
      expect(result).toEqual(mockResults);
    });
  });

  describe('getProduct', () => {
    it('should call service.findOne and return product', async () => {
      const dto: GetProductDto = { id: 'prod-123' };
      service.findOne.mockResolvedValue(mockResult);

      const result = await controller.getProduct(dto);

      expect(service.findOne).toHaveBeenCalledWith(dto.id);
      expect(result).toEqual(mockResult);
    });
  });

  describe('findProduct', () => {
    it('should call service.findByName with branchId and name', async () => {
      const dto: FindProductsByNameDto = {
        branchId: 'branch-999',
        name: 'Марг',
      };
      const mockResults = [mockResult];
      service.findByName.mockResolvedValue(mockResults);

      const result = await controller.findProduct(dto);

      expect(service.findByName).toHaveBeenCalledWith(dto.branchId, dto.name);
      expect(result).toEqual(mockResults);
    });
  });
});
