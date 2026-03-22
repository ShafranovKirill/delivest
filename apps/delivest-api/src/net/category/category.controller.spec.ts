/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BranchController } from './category.controller.js';
import { BranchService } from './category.service.js';
import { jest } from '@jest/globals';
import { GetBranchDto } from './dto/get-branch.dto.js';
import { ReadBranchDto } from './dto/read-category.dto.js';

describe('BranchController', () => {
  let controller: BranchController;
  let service: jest.Mocked<BranchService>;

  const mockBranchService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    getBranchDetails: jest.fn(),
  };

  const request: GetBranchDto = { id: '123' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchController],
      providers: [
        {
          provide: BranchService,
          useValue: mockBranchService,
        },
      ],
    }).compile();

    controller = module.get<BranchController>(BranchController);
    service = module.get(BranchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAllBranch', () => {
    it('should call service.findAll and return results', async () => {
      const mockResult: ReadBranchDto[] = [
        { id: '123', name: 'branch', alias: 'url' },
      ];

      service.findAll.mockResolvedValue(mockResult as any);

      const result = await controller.findAllBranch();

      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getBranch', () => {
    it('should call service.findOne and return branch', async () => {
      const mockResult = { id: '123', name: 'branch' };
      service.findOne.mockResolvedValue(mockResult as any);

      const result = await controller.getBranch(request);

      expect(service.findOne).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getBranchDetails', () => {
    it('should call service.getBranchDetails and return details', async () => {
      const mockResult = { id: '123', address: 'street' };
      service.getBranchDetails.mockResolvedValue(mockResult as any);

      const result = await controller.getBranchDetails(request);

      expect(service.getBranchDetails).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockResult);
    });
  });
});
