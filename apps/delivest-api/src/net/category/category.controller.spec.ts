/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller.js';
import { CategoryService } from './category.service.js';
import { jest } from '@jest/globals';
import { ReadCategoryDto } from './dto/read.dto.js';
import { FindCategoryDto } from './dto/find.dto.js';
import { GetCategoryByBranchDto } from './dto/find-by-branch.dto.js';

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: jest.Mocked<CategoryService>;

  const mockCategoryService = {
    findAllByBranch: jest.fn(),
    findOne: jest.fn(),
  };

  const mockGetCategoryDto: FindCategoryDto = { id: '123' };
  const mockGetByBranchCategoryDto: GetCategoryByBranchDto = {
    branchId: '123',
  };
  const mockResult: ReadCategoryDto = {
    id: '123',
    name: 'Пицца',
    order: 1,
  } as ReadCategoryDto;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
      ],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    service = module.get(CategoryService) as jest.Mocked<CategoryService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllCtaegory', () => {
    it('should call service.findAllByBranch and return results', async () => {
      const mockResults = [mockResult];
      service.findAllByBranch.mockResolvedValue(mockResults);

      const result = await controller.getAllCategory(
        mockGetByBranchCategoryDto,
      );

      expect(service.findAllByBranch).toHaveBeenCalledWith(
        mockGetByBranchCategoryDto.branchId,
      );
      expect(service.findAllByBranch).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResults);
    });
  });

  describe('getCategory', () => {
    it('should call service.findOne and return category', async () => {
      service.findOne.mockResolvedValue(mockResult);

      const result = await controller.getCategory(mockGetCategoryDto);

      expect(service.findOne).toHaveBeenCalledWith(mockGetCategoryDto.id);
      expect(service.findOne).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });
  });
});
