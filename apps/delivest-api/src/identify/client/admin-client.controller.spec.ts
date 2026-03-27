import { Test, TestingModule } from '@nestjs/testing';
import { AdminClientController } from './admin-client.controller.js';
import { ClientService } from './client.service.js';
import { jest } from '@jest/globals';
import { JwtStaffAuthGuard } from '../staff/guards/jwt-staff.guard.js';
import { AclGuard } from '../acl/guards/acl.guard.js';
import { Permission } from '../../../generated/prisma/enums.js';

describe('AdminClientController', () => {
  let controller: AdminClientController;
  let service: jest.Mocked<ClientService>;

  const mockClientService = {
    findAll: jest.fn(),
    findOneByPhone: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockClient = {
    id: 'client-123',
    phone: '+79991112233',
    name: 'Иван Иванов',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminClientController],
      providers: [
        {
          provide: ClientService,
          useValue: mockClientService,
        },
      ],
    })
      // Мокаем гарды, чтобы они всегда пропускали запросы
      .overrideGuard(JwtStaffAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AclGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminClientController>(AdminClientController);
    service = module.get(ClientService) as jest.Mocked<ClientService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of clients', async () => {
      const mockClients = [mockClient];
      service.findAll.mockResolvedValue(mockClients as any);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockClients);
    });
  });

  describe('findByPhone', () => {
    it('should return a client by phone with extended data', async () => {
      const dto = { phone: '+79991112233' };
      service.findOneByPhone.mockResolvedValue(mockClient as any);

      const result = await controller.findByPhone(dto);

      // Проверяем, что передается true для extended данных (AdminReadClientDto)
      expect(service.findOneByPhone).toHaveBeenCalledWith(dto.phone, true);
      expect(result).toEqual(mockClient);
    });
  });

  describe('findOne', () => {
    it('should return a client by id with extended data', async () => {
      const dto = { id: 'client-123' };
      service.findOne.mockResolvedValue(mockClient as any);

      const result = await controller.findOne(dto);

      expect(service.findOne).toHaveBeenCalledWith(dto.id, true);
      expect(result).toEqual(mockClient);
    });
  });

  describe('create', () => {
    it('should create a new client', async () => {
      const dto = { phone: '+79991112233', name: 'New Client' };
      service.create.mockResolvedValue(mockClient as any);

      const result = await controller.create(dto as any);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockClient);
    });
  });

  describe('update', () => {
    it('should update client information', async () => {
      const id = 'client-123';
      const updateDto = { name: 'Updated Name' };
      const updatedClient = { ...mockClient, name: 'Updated Name' };

      service.update.mockResolvedValue(updatedClient as any);

      const result = await controller.update(id, updateDto);

      expect(service.update).toHaveBeenCalledWith(id, updateDto);
      expect(result).toEqual(updatedClient);
    });
  });

  describe('softDelete', () => {
    it('should call softDelete on service', async () => {
      const dto = { id: 'client-123' };
      service.softDelete.mockResolvedValue(undefined);

      await controller.softDelete(dto);

      expect(service.softDelete).toHaveBeenCalledWith(dto.id);
    });
  });
});
