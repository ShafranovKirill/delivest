import { Test, TestingModule } from '@nestjs/testing';
import { AdminCategoryController } from './admin-category.controller.js';
import { CategoryService } from './category.service.js';
import { jest } from '@jest/globals';
import { JwtStaffAuthGuard } from '../../identify/index.js';
import { AclGuard } from '../../identify/acl/guards/acl.guard.js';
import { CreateCategoryDto } from './dto/create.dto.js';
import { UpdateCategoryDto } from './dto/update.dto.js';

describe('AdminCategoryController', () => {
  let controller: AdminCategoryController;
  let service: jest.Mocked<CategoryService>;

  const mockCategory = {
    id: 'cat-123',
    name: 'Пицца',
    branchId: 'branch-999',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCategoryService = {
    findAllByBranch: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
      ],
    })
      .overrideGuard(JwtStaffAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AclGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminCategoryController>(AdminCategoryController);
    service = module.get(CategoryService) as jest.Mocked<CategoryService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const dto: CreateCategoryDto = {
        name: 'Суши',
        branchId: 'branch-999',
        order: 2,
      };
      service.create.mockResolvedValue(mockCategory as any);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('findAllByBranch', () => {
    it('should return all categories for a branch with extended data', async () => {
      const branchId = 'branch-999';
      const mockCategories = [mockCategory];
      service.findAllByBranch.mockResolvedValue(mockCategories as any);

      const result = await controller.findAllByBranch(branchId);

      // Проверяем, что в сервис передается флаг true для AdminReadCategoryDto
      expect(service.findAllByBranch).toHaveBeenCalledWith(branchId, true);
      expect(result).toEqual(mockCategories);
    });
  });

  describe('update', () => {
    it('should update category information', async () => {
      const id = 'cat-123';
      const updateDto: UpdateCategoryDto = { name: 'Обновленная Пицца' };
      const updatedCategory = { ...mockCategory, name: 'Обновленная Пицца' };

      service.update.mockResolvedValue(updatedCategory as any);

      const result = await controller.update(id, updateDto);

      expect(service.update).toHaveBeenCalledWith(id, updateDto);
      expect(result).toEqual(updatedCategory);
    });
  });

  describe('findOne', () => {
    it('should return a single category by id with extended data', async () => {
      const id = 'cat-123';
      service.findOne.mockResolvedValue(mockCategory as any);

      const result = await controller.findOne(id);

      expect(service.findOne).toHaveBeenCalledWith(id, true);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('softDelete', () => {
    it('should call softDelete on service', async () => {
      const id = 'cat-123';
      service.softDelete.mockResolvedValue(undefined);

      await controller.softDelete(id);

      expect(service.softDelete).toHaveBeenCalledWith(id);
    });
  });
});