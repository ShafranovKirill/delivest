import { Test, TestingModule } from '@nestjs/testing';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';
import { jest } from '@jest/globals';
import { Response, Request } from 'express';
import { MissingTokenException } from '../../shared/exception/domain_exception/domain-exception.js';
import { JwtStaffAuthGuard } from './guards/jwt-staff.guard.js';
import { AclGuard } from '../acl/guards/acl.guard.js';
import { UpdateStaffDto } from './dto/update.dto.js';

describe('StaffController', () => {
  let controller: StaffController;
  let service: jest.Mocked<StaffService>;

  const mockStaffService = {
    validateCredentials: jest.fn(),
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    setRefreshCookie: jest.fn(),
    create: jest.fn(),
    refresh: jest.fn(),
    findOne: jest.fn(),
    changePassword: jest.fn(),
    findOneByLogin: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findAll: jest.fn(),
  };

  const mockResponse = {
    cookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffController],
      providers: [
        {
          provide: StaffService,
          useValue: mockStaffService,
        },
      ],
    })
      .overrideGuard(JwtStaffAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AclGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StaffController>(StaffController);
    service = module.get(StaffService) as jest.Mocked<StaffService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login staff and return access token', async () => {
      const dto = { login: 'admin', password: 'password123' };
      const mockStaff = { id: 'staff-1', login: 'admin' };
      const accessToken = 'access_token_val';
      const refreshToken = 'refresh_token_val';

      service.validateCredentials.mockResolvedValue(mockStaff as any);
      service.generateAccessToken.mockResolvedValue(accessToken);
      service.generateRefreshToken.mockResolvedValue(refreshToken);

      const result = await controller.login(dto, mockResponse);

      expect(service.validateCredentials).toHaveBeenCalledWith(dto);
      expect(service.setRefreshCookie).toHaveBeenCalledWith(
        mockResponse,
        refreshToken,
      );
      expect(result).toEqual({ accessToken });
    });
  });

  describe('register', () => {
    it('should register staff and return access token', async () => {
      const dto = {
        login: 'new_manager',
        password: 'password',
        roleId: 'role-1',
        name: 'Иван Иванов',
      };
      const mockStaff = { id: 'staff-2' };
      const accessToken = 'access_token_reg';
      const refreshToken = 'refresh_token_reg';

      service.create.mockResolvedValue(mockStaff as any);
      service.generateAccessToken.mockResolvedValue(accessToken);
      service.generateRefreshToken.mockResolvedValue(refreshToken);

      const result = await controller.register(mockResponse, dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(service.setRefreshCookie).toHaveBeenCalledWith(
        mockResponse,
        refreshToken,
      );
      expect(result).toEqual({ accessToken });
    });
  });

  describe('refresh', () => {
    it('should return new access token if staff cookie exists', async () => {
      const mockRequest = {
        cookies: { staff_refresh_token: 'valid_refresh_token' },
      } as unknown as Request;
      const newAccessToken = 'brand_new_access_token';

      service.refresh.mockResolvedValue(newAccessToken);

      const result = await controller.refresh(mockRequest);

      expect(service.refresh).toHaveBeenCalledWith('valid_refresh_token');
      expect(result).toEqual({ accessToken: newAccessToken });
    });

    it('should throw MissingTokenException if no cookies present', async () => {
      const mockRequest = { cookies: {} } as unknown as Request;

      await expect(controller.refresh(mockRequest)).rejects.toThrow(
        MissingTokenException,
      );
    });
  });

  describe('findMe', () => {
    it('should return staff profile by id from decorator', async () => {
      const staffId = 'staff-uuid';
      const mockResult = { id: staffId, login: 'manager_1' };
      service.findOne.mockResolvedValue(mockResult as any);

      const result = await controller.findMe(staffId);

      expect(service.findOne).toHaveBeenCalledWith(staffId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('changePassword', () => {
    it('should call changePassword with staff id and dto', async () => {
      const staffId = 'staff-uuid';
      const dto = { oldPassword: 'old', newPassword: 'new' };

      await controller.changePassword(staffId, dto);

      expect(service.changePassword).toHaveBeenCalledWith(staffId, dto);
    });
  });

  describe('findByPhone (login)', () => {
    it('should find staff by login query', async () => {
      const dto = { login: 'search_me' };
      const mockResult = { id: '10', login: 'search_me' };
      service.findOneByLogin.mockResolvedValue(mockResult as any);

      const result = await controller.findByLogin(dto);

      expect(service.findOneByLogin).toHaveBeenCalledWith(dto.login);
      expect(result).toEqual(mockResult);
    });
  });

  describe('update', () => {
    it('should update staff data and return ReadStaffDto', async () => {
      const id = 'staff-1';
      const dto = { name: 'Обновленное Имя' } as UpdateStaffDto;
      const mockResult = { id, name: 'Обновленное Имя', login: 'admin' };

      service.update.mockResolvedValue(mockResult as any);

      const result = await controller.update(id, dto);

      expect(service.update).toHaveBeenCalledWith(id, dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('softDelete', () => {
    it('should call softDelete on service with correct id', async () => {
      const id = 'staff-to-delete';
      service.softDelete.mockResolvedValue(undefined);

      await controller.softDelete(id);

      expect(service.softDelete).toHaveBeenCalledWith(id);
    });
  });

  describe('findAll', () => {
    it('should return an array of staff members', async () => {
      const mockStaffList = [
        { id: '1', login: 'admin' },
        { id: '2', login: 'manager' },
      ];
      service.findAll.mockResolvedValue(mockStaffList as any);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockStaffList);
      expect(result.length).toBe(2);
    });
  });

  describe('findOne', () => {
    it('should return a single staff member by id from Param DTO', async () => {
      const dto = { id: 'specific-staff-id' };
      const mockResult = { id: 'specific-staff-id', login: 'target_user' };

      service.findOne.mockResolvedValue(mockResult as any);

      const result = await controller.findOne(dto);

      expect(service.findOne).toHaveBeenCalledWith(dto.id);
      expect(result).toEqual(mockResult);
    });
  });
});
