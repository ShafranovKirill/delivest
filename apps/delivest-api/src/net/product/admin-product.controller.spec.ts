import { Test, TestingModule } from '@nestjs/testing';
import { AdminProductController } from './admin-product.controller.js';
import { ProductService } from './product.service.js';
import { jest } from '@jest/globals';
import { JwtStaffAuthGuard } from '../../identify/index.js';
import { AclGuard } from '../../identify/acl/guards/acl.guard.js';
import { CreateProductDto } from './dto/create.dto.js';
import { UpdateProductDto } from './dto/update.dto.js';

describe('AdminProductController', () => {
  let controller: AdminProductController;
  let service: jest.Mocked<ProductService>;

  const mockProduct = {
    id: 'prod-123',
    name: 'Маргарита',
    price: 550,
    branchId: 'branch-999',
    categoryId: 'cat-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockProductService = {
    create: jest.fn(),
    findAllByBranch: jest.fn(),
    findAllByCategory: jest.fn(),
    findByName: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminProductController],
      providers: [
        {
          provide: ProductService,
          useValue: mockProductService,
        },
      ],
    })
      .overrideGuard(JwtStaffAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AclGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminProductController>(AdminProductController);
    service = module.get(ProductService) as jest.Mocked<ProductService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new product', async () => {
      const dto: CreateProductDto = {
        name: 'Пепперони',
        price: 600,
        branchId: 'branch-999',
        categoryId: 'cat-001',
      } as any;
      service.create.mockResolvedValue(mockProduct as any);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto, undefined);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('findAllByBranch', () => {
    it('should return products for a branch with extended data', async () => {
      const branchId = 'branch-999';
      service.findAllByBranch.mockResolvedValue([mockProduct] as any);

      const result = await controller.findAllByBranch(branchId);

      expect(service.findAllByBranch).toHaveBeenCalledWith(branchId, true);
      expect(result).toEqual([mockProduct]);
    });
  });

  describe('findAllByCategory', () => {
    it('should return products for a category with extended data', async () => {
      const catId = 'cat-001';
      service.findAllByCategory.mockResolvedValue([mockProduct] as any);

      const result = await controller.findAllByCategory(catId);

      expect(service.findAllByCategory).toHaveBeenCalledWith(catId, true);
      expect(result).toEqual([mockProduct]);
    });
  });

  describe('findByName', () => {
    it('should search products by name and branchId', async () => {
      const branchId = 'branch-999';
      const name = 'пицца';
      service.findByName.mockResolvedValue([mockProduct] as any);

      const result = await controller.findByName(branchId, name);

      expect(service.findByName).toHaveBeenCalledWith(branchId, name, true);
      expect(result).toEqual([mockProduct]);
    });
  });

  describe('findOne', () => {
    it('should return a single product by id with extended data', async () => {
      const id = 'prod-123';
      service.findOne.mockResolvedValue(mockProduct as any);

      const result = await controller.findOne(id);

      expect(service.findOne).toHaveBeenCalledWith(id, true);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('update', () => {
    it('should update product information', async () => {
      const updateDto: UpdateProductDto = { productId: 'prod-123', price: 700 };
      const updatedProduct = { ...mockProduct, price: 700 };

      service.update.mockResolvedValue(updatedProduct as any);

      const result = await controller.update(updateDto);

      expect(service.update).toHaveBeenCalledWith(updateDto, undefined);
      expect(result).toEqual(updatedProduct);
    });
  });

  describe('softDelete', () => {
    it('should call softDelete on service', async () => {
      const id = 'prod-123';
      service.softDelete.mockResolvedValue(undefined);

      await controller.softDelete(id);

      expect(service.softDelete).toHaveBeenCalledWith(id, undefined);
    });
  });
});
