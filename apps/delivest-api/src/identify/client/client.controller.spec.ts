import { Test, TestingModule } from '@nestjs/testing';
import { ClientController } from './client.controller.js';
import { ClientService } from './client.service.js';
import { jest } from '@jest/globals';
import { Response, Request } from 'express';
import { MissingTokenException } from '../../shared/exceptions/domain_exception/domain-exception.js';
import { JwtClientAuthGuard } from './guards/jwt-client.guard.js';
import { SendCodeType } from '../../../generated/prisma/client.js';

describe('ClientController', () => {
  let controller: ClientController;
  let service: jest.Mocked<ClientService>;

  const mockClientService = {
    loginByCode: jest.fn(),
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    setRefreshCookie: jest.fn(),
    sendCode: jest.fn(),
    refresh: jest.fn(),
    findOne: jest.fn(),
    changePassword: jest.fn(),
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

  describe('loginByCode', () => {
    it('should login client by code and return access token', async () => {
      const dto = { phone: '79991234567', code: '1234' };
      const mockAccount = { id: '1' };
      const accessToken = 'access_token';
      const refreshToken = 'refresh_token';

      service.loginByCode.mockResolvedValue(mockAccount as any);
      service.generateAccessToken.mockResolvedValue(accessToken);
      service.generateRefreshToken.mockResolvedValue(refreshToken);

      const result = await controller.loginByCode(dto, mockResponse);

      expect(service.loginByCode).toHaveBeenCalledWith(dto.phone, dto.code);
      expect(service.generateAccessToken).toHaveBeenCalledWith(mockAccount);
      expect(service.setRefreshCookie).toHaveBeenCalledWith(
        mockResponse,
        refreshToken,
      );
      expect(result).toEqual({ accessToken });
    });
  });

  describe('sendCode', () => {
    it('should call service.sendCode with Zvonok type', async () => {
      const dto = { phone: '79991234567' };
      const expectedResponse = { success: true };

      service.sendCode.mockResolvedValue(expectedResponse as any);

      const result = await controller.sendCode(dto);

      expect(service.sendCode).toHaveBeenCalledWith(
        dto.phone,
        SendCodeType.ZVONOK,
      );
      expect(result).toEqual(expectedResponse);
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
});
