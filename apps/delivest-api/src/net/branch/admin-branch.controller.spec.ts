/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AdminBranchController } from './admin-branch.controller.js';
import { BranchService } from './branch.service.js';
import { jest } from '@jest/globals';
import { CreateBranchDto } from './dto/create.dto.js';
import { UpdateBranchDto } from './dto/update.dto.js';
import { JwtStaffAuthGuard } from '../../identify/index.js';
import { AclGuard } from '../../identify/acl/guards/acl.guard.js';

describe('AdminBranchController', () => {
  let controller: AdminBranchController;
  let service: jest.Mocked<BranchService>;

  const branchId = 'uuid-123';

  const mockBranchService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateInfo: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBranchController],
      providers: [
        {
          provide: BranchService,
          useValue: mockBranchService,
        },
      ],
    })
      .overrideGuard(JwtStaffAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AclGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminBranchController>(AdminBranchController);
    service = module.get(BranchService) as jest.Mocked<BranchService>;

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call service.create with dto', async () => {
      const dto: CreateBranchDto = { name: 'New Branch', alias: 'new-alias' };
      service.create.mockResolvedValue({ id: branchId, ...dto } as any);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe(branchId);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with extended flag true', async () => {
      service.findAll.mockResolvedValue([]);
      await controller.findAll();
      expect(service.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id and extended flag true', async () => {
      service.findOne.mockResolvedValue({ id: branchId } as any);
      await controller.findOne(branchId);
      expect(service.findOne).toHaveBeenCalledWith(branchId, true);
    });
  });

  describe('update', () => {
    it('should call service.update with id and dto', async () => {
      const dto: UpdateBranchDto = { name: 'Updated Name' };
      service.update.mockResolvedValue({ id: branchId, ...dto } as any);
      const result = await controller.update(branchId, dto);
      expect(service.update).toHaveBeenCalledWith(branchId, dto);
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('softDelete', () => {
    it('should call service.softDelete with correct id', async () => {
      service.softDelete.mockResolvedValue(undefined);
      await controller.softDelete(branchId);
      expect(service.softDelete).toHaveBeenCalledWith(branchId);
    });
  });
});
