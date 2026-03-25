import { Test, TestingModule } from '@nestjs/testing';
import { ClientController } from './client.controller.js';
import { ClientService } from './client.service.js';
import { jest } from '@jest/globals';
import { Response, Request } from 'express';
import { MissingTokenException } from '../../shared/exception/domain_exception/domain-exception.js';
import { JwtClientAuthGuard } from './guards/jwt-client.guard.js';

describe('ClientController', () => {
  let controller: ClientController;
  let service: jest.Mocked<ClientService>;

  const mockClientService = {
    validateCredentials: jest.fn(),
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    setRefreshCookie: jest.fn(),
    create: jest.fn(),
    refresh: jest.fn(),
    findOne: jest.fn(),
    changePassword: jest.fn(),
    findOneByPhone: jest.fn(),
  };

  const mockResponse = {
    cookie: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientController],
      providers: [
        {
          provide: ClientService,
          useValue: mockClientService,
        },
      ],
    })
      .overrideGuard(JwtClientAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ClientController>(ClientController);
    service = module.get(ClientService) as jest.Mocked<ClientService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should login client and return access token', async () => {
      const dto = { phone: '79991234567', password: 'password' };
      const mockClient = { id: '1' };
      const accessToken = 'access_token';
      const refreshToken = 'refresh_token';

      service.validateCredentials.mockResolvedValue(mockClient as any);
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
    it('should register client and return access token', async () => {
      const dto = { phone: '79991234567', password: 'password', name: 'Test' };
      const mockClient = { id: '1' };
      const accessToken = 'access_token';
      const refreshToken = 'refresh_token';

      service.create.mockResolvedValue(mockClient as any);
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
    it('should return new access token if cookie exists', async () => {
      const mockRequest = {
        cookies: { client_refresh_token: 'old_refresh_token' },
      } as unknown as Request;
      const newAccessToken = 'new_access_token';

      service.refresh.mockResolvedValue(newAccessToken);

      const result = await controller.refresh(mockRequest);

      expect(service.refresh).toHaveBeenCalledWith('old_refresh_token');
      expect(result).toEqual({ accessToken: newAccessToken });
    });

    it('should throw MissingTokenException if no cookie', async () => {
      const mockRequest = { cookies: {} } as unknown as Request;

      await expect(controller.refresh(mockRequest)).rejects.toThrow(
        MissingTokenException,
      );
    });
  });

  describe('findMe', () => {
    it('should return current client data', async () => {
      const clientId = 'user-123';
      const mockResult = { id: clientId, phone: '79991234567' };
      service.findOne.mockResolvedValue(mockResult as any);

      const result = await controller.findMe(clientId);

      expect(service.findOne).toHaveBeenCalledWith(clientId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('changePassword', () => {
    it('should call service.changePassword', async () => {
      const clientId = 'user-123';
      const dto = { oldPassword: '123', newPassword: '456' };

      await controller.changePassword(clientId, dto);

      expect(service.changePassword).toHaveBeenCalledWith(clientId, dto);
    });
  });

  describe('findByPhone', () => {
    it('should find client by phone number', async () => {
      const dto = { phone: '79991234567' };
      const mockResult = { id: '1', phone: '79991234567' };
      service.findOneByPhone.mockResolvedValue(mockResult as any);

      const result = await controller.findByPhone(dto);

      expect(service.findOneByPhone).toHaveBeenCalledWith(dto.phone);
      expect(result).toEqual(mockResult);
    });
  });
});
