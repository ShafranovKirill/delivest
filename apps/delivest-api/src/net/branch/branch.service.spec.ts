import { Test, TestingModule } from '@nestjs/testing';
import { BranchService } from './branch.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { jest } from '@jest/globals';
import { Branch, BranchInfo } from '../../generated/prisma/client.js';
import { ReadBranchDto } from './dto/read-branch.dto.js';
import {
  BadRequestException,
  NotFoundException,
} from '../../shared/exception/domain_exception/domain-exception.js';
import { GetBranchDto } from './dto/get-branch.dto.js';
import { ReadBranchDetailsDto } from './dto/read-branch-details.dto.js';

describe('BranchService', () => {
  let service: BranchService;
  let mockPrisma: {
    branch: {
      findUnique: jest.Mock<any>;
      findMany: jest.Mock<any>;
    };
    branchInfo: {
      findUnique: jest.Mock<any>;
    };
  };
  const request: GetBranchDto = { id: '123' };
  const mockBranch: Branch = {
    id: '123',
    name: 'branch',
    alias: 'url',
  };

  const mockDetails: BranchInfo = {
    id: '123',
    branchId: '123',
    address: 'street',
    description: 'rest',
  };

  beforeEach(async () => {
    const prismaMock = {
      branch: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      branchInfo: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<BranchService>(BranchService);

    mockPrisma = module.get(PrismaService);
  });
  describe('findAll', () => {
    it('should return branches', async () => {
      const mockBranches = [mockBranch];
      mockPrisma.branch.findMany.mockResolvedValue(mockBranches);
      const result = await service.findAll();
      const expectedOutput: ReadBranchDto[] = [
        {
          id: '123',
          name: 'branch',
          alias: 'url',
        },
      ];
      expect(result).toEqual(expectedOutput);
    });

    it('should throw not found exception if brach not exist', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([]);
      await expect(service.findAll()).rejects.toThrow(NotFoundException);
    });

    it('should throw bad request exception if not domain exception', async () => {
      const dbError = new Error('Conection refused');
      mockPrisma.branch.findMany.mockRejectedValue(dbError);
      await expect(service.findAll()).rejects.toThrow(BadRequestException);
    });
  });
  describe('findOne', () => {
    it('should return branch', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(mockBranch);
      const result = await service.findOne(request);
      const expectedOutput: ReadBranchDto = {
        id: '123',
        name: 'branch',
        alias: 'url',
      };
      expect(result).toEqual(expectedOutput);
    });

    it('should throw not found exception if brach not exist', async () => {
      mockPrisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.findOne(request)).rejects.toThrow(NotFoundException);
    });

    it('should throw bad request exception if not domain exception', async () => {
      const dbError = new Error('Conection refused');
      mockPrisma.branch.findUnique.mockRejectedValue(dbError);
      await expect(service.findOne(request)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
  describe('getBranchDetails', () => {
    it('should return detail', async () => {
      mockPrisma.branchInfo.findUnique.mockResolvedValue(mockDetails);
      const result = await service.getBranchDetails(request);
      const expectedOutput: ReadBranchDetailsDto = {
        id: '123',
        address: 'street',
        description: 'rest',
      };
      expect(result).toEqual(expectedOutput);
    });

    it('should throw not found exception if brach not exist', async () => {
      mockPrisma.branchInfo.findUnique.mockResolvedValue(null);
      await expect(service.getBranchDetails(request)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw bad request exception if not domain exception', async () => {
      const dbError = new Error('Conection refused');
      mockPrisma.branchInfo.findUnique.mockRejectedValue(dbError);
      await expect(service.getBranchDetails(request)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
