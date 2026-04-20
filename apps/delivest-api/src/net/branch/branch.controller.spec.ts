import { Test, TestingModule } from '@nestjs/testing';
import { BranchController } from './branch.controller.js';
import { BranchService } from './branch.service.js';
import { jest } from '@jest/globals';
import { ReadBranchDto } from './dto/read-branch.dto.js';
import { FindBranchDto } from './dto/find-branch.dto.js';

describe('BranchController', () => {
  let controller: BranchController;
  let service: jest.Mocked<BranchService>;

  const mockBranchService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    getBranchDetails: jest.fn(),
  };

  const branchId = '123';
  const findBranchDto: FindBranchDto = { id: branchId };

  beforeEach(async () => {
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
    service = module.get(BranchService) as jest.Mocked<BranchService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAllBranch', () => {
    it('should call service.findAll and return results', async () => {
      const mockResult: ReadBranchDto[] = [
        { id: branchId, name: 'branch', alias: 'url' } as any,
      ];

      service.findAll.mockResolvedValue(mockResult as any);

      const result = await controller.findAllBranch();

      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getBranch', () => {
    it('should call service.findOne with id string and return branch', async () => {
      const mockResult = { id: branchId, name: 'branch' };
      service.findOne.mockResolvedValue(mockResult as any);

      const result = await controller.getBranch(findBranchDto);

      expect(service.findOne).toHaveBeenCalledWith(branchId);
      expect(result).toEqual(mockResult);
    });
  });
});
