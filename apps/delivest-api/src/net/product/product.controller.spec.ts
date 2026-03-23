import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';
import { jest } from '@jest/globals';
import { GetProductDto } from './dto/get-product.dto.js';
import { ReadProductDto } from './dto/read-product.dto.js';
import { FindProductsDto } from './dto/find-products.dto.js';

describe('ProductController', () => {
  let controller: ProductController;
  let service: jest.Mocked<ProductService>;

  const mockProductService = {
    findAllByBranch: jest.fn(),
    findAllByCategory: jest.fn(),
    findOne: jest.fn(),
    findByName: jest.fn(),
  };

  const mockGetDto: GetProductDto = { id: 'prod-123' };

  const mockResult: ReadProductDto = {
    id: 'prod-123',
    name: 'Маргарита',
    order: 1,
  } as ReadProductDto;

  beforeEach(async () => {
    jest.clearAllMocks();
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
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllProductsByBranch', () => {
    it('should call service.findAllByBranch and return results', async () => {
      const mockResults = [mockResult];
      service.findAllByBranch.mockResolvedValue(mockResults);

      const result = await controller.getAllProductsByBranch(mockGetDto);

      expect(service.findAllByBranch).toHaveBeenCalledWith(mockGetDto.id);
      expect(result).toEqual(mockResults);
    });
  });

  describe('getAllProductsByCategory', () => {
    it('should call service.findAllByCategory and return results', async () => {
      const mockResults = [mockResult];
      service.findAllByCategory.mockResolvedValue(mockResults);

      const result = await controller.getAllProductsByCategory(mockGetDto);

      expect(service.findAllByCategory).toHaveBeenCalledWith(mockGetDto.id);
      expect(result).toEqual(mockResults);
    });
  });

  describe('getProduct', () => {
    it('should call service.findOne and return product', async () => {
      service.findOne.mockResolvedValue(mockResult);

      const result = await controller.getProduct(mockGetDto);

      expect(service.findOne).toHaveBeenCalledWith(mockGetDto.id);
      expect(result).toEqual(mockResult);
    });
  });

  describe('findProduct', () => {
    it('should call service.findByName with branchId and name', async () => {
      const findDto: FindProductsDto = { branchId: 'branch-999', name: 'Марг' };
      const mockResults = [mockResult];
      service.findByName.mockResolvedValue(mockResults);

      const result = await controller.findProduct(findDto);

      expect(service.findByName).toHaveBeenCalledWith(
        findDto.branchId,
        findDto.name,
      );
      expect(result).toEqual(mockResults);
    });
  });
});
