import { Test, TestingModule } from '@nestjs/testing';
import { RoleController } from './role.controller.js';
import { RoleService } from './role.service.js';
import { jest } from '@jest/globals';
import { JwtStaffAuthGuard } from '../staff/guards/jwt-staff.guard.js';
import { AclGuard } from '../acl/guards/acl.guard.js';
import { Permission } from '../../../generated/prisma/enums.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

describe('RoleController', () => {
  let controller: RoleController;
  let service: jest.Mocked<RoleService>;

  const mockRole = {
    id: 'role-uuid',
    name: 'Admin',
    permissions: [Permission.STAFF_READ],
  };

  const mockRoleService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [
        {
          provide: RoleService,
          useValue: mockRoleService,
        },
      ],
    })
      .overrideGuard(JwtStaffAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AclGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RoleController>(RoleController);
    service = module.get(RoleService) as jest.Mocked<RoleService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with dto', async () => {
      const dto: CreateRoleDto = { name: 'Manager', permissions: [] };
      service.create.mockResolvedValue(mockRole as any);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockRole);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll', async () => {
      const mockRoles = [mockRole];
      service.findAll.mockResolvedValue(mockRoles as any);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockRoles);
    });
  });

  describe('findOne', () => {
    it('should call service.findById with id from GetRoleDto', async () => {
      const dto = { id: 'role-uuid' };
      service.findById.mockResolvedValue(mockRole as any);

      const result = await controller.findOne(dto);

      expect(service.findById).toHaveBeenCalledWith(dto.id);
      expect(result).toEqual(mockRole);
    });
  });

  describe('update', () => {
    it('should call service.update with id and dto', async () => {
      const id = 'role-uuid';
      const dto: UpdateRoleDto = { name: 'New Name' };
      const updatedRole = { ...mockRole, name: 'New Name' };

      service.update.mockResolvedValue(updatedRole as any);

      const result = await controller.update(id, dto);

      expect(service.update).toHaveBeenCalledWith(id, dto);
      expect(result).toEqual(updatedRole);
    });
  });

  describe('remove', () => {
    it('should call service.softDelete with id', async () => {
      const id = 'role-uuid';
      service.softDelete.mockResolvedValue(undefined);

      await controller.remove(id);

      expect(service.softDelete).toHaveBeenCalledWith(id);
    });
  });
});
