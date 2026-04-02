import {
  AccessClientTokenPayload,
  RefreshClientTokenPayload,
} from '@delivest/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toDto } from '../../utils/to-dto.js';
import { CreateClientDto } from './dto/create.dto.js';
import { ReadClientDto } from './dto/read.dto.js';
import {
  CountryCode,
  parsePhoneNumberWithError,
  PhoneNumber,
} from 'libphonenumber-js';
import {
  BadRequestException,
  DomainException,
  DuplicateValueException,
  ForbiddenException,
  InvalidPhoneNumberException,
  NotFoundException,
  PhoneAlreadyExistsException,
  UserNotFoundException,
} from '../../shared/exception/domain_exception/domain-exception.js';
import { Client, SendCodeType } from '../../../generated/prisma/client.js';
import {
  getInternalErrorCode,
  getPrismaModelName,
  isPrismaError,
} from '../../shared/helpers/db-errors.js';
import { PrismaErrorCode } from '@delivest/common';
import { AdminReadClientDto } from './dto/admin-read.dto.js';
import { UpdateClientDto } from './dto/update.dto.js';
import { NotificationService } from '../../notification/notification.service.js';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    this.accessTtl = +this.config.get<number>(
      'JWT_ACCESS_TTL_SECONDS_CLIENT',
      900,
    );
    this.refreshTtl = +this.config.get<number>(
      'JWT_REFRESH_TTL_SECONDS_CLIENT',
      604800,
    );
    this.accessSecret = this.config.get<string>('JWT_ACCESS_SECRET_CLIENT', '');
    this.refreshSecret = this.config.get<string>(
      'JWT_REFRESH_SECRET_CLIENT',
      '',
    );
  }

  async findOne(id: string, extended: true): Promise<AdminReadClientDto>;
  async findOne(id: string): Promise<ReadClientDto>;

  async findOne(
    id: string,
    extended?: boolean,
  ): Promise<ReadClientDto | AdminReadClientDto> {
    try {
      const client = await this.prisma.client.findUnique({
        where: { id: id },
      });

      if (!client) {
        this.logger.warn(`findOne() | <client> not found | id=${id}`);
        throw new UserNotFoundException('Client not found');
      }

      if (extended === true) {
        return toDto(client, AdminReadClientDto);
      }
      return toDto(client, ReadClientDto);
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findOne() | ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new BadRequestException('Failed to fetch client');
    }
  }

  async findOneByPhone(
    phone: string,
    extended: true,
  ): Promise<AdminReadClientDto>;
  async findOneByPhone(phone: string): Promise<ReadClientDto>;

  async findOneByPhone(
    phone: string,
    extended?: boolean,
  ): Promise<ReadClientDto | AdminReadClientDto> {
    try {
      const client = await this.prisma.client.findUnique({
        where: { phone: phone },
      });

      if (!client) {
        this.logger.warn(
          `findOneByPhone() | Client not found | phone=${phone}`,
        );
        throw new UserNotFoundException('Client not found');
      }

      if (extended === true) {
        return toDto(client, AdminReadClientDto);
      }
      return toDto(client, ReadClientDto);
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findOneByPhone() | ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new BadRequestException('Failed to fetch client');
    }
  }

  async findAll(): Promise<ReadClientDto[]>;
  async findAll(extended: true): Promise<AdminReadClientDto[]>;

  async findAll(
    extended?: boolean,
  ): Promise<ReadClientDto[] | AdminReadClientDto[]> {
    try {
      const clients = await this.prisma.client.findMany({
        where: { deletedAt: null },
      });

      if (extended === true) {
        return clients.map((client) => toDto(client, AdminReadClientDto));
      }
      return clients.map((client) => toDto(client, ReadClientDto));
    } catch (error) {
      this.logger.error(
        `findAll() | error find all client ${(error as Error).stack}`,
      );
      throw new BadRequestException();
    }
  }

  async create(dto: CreateClientDto): Promise<Client> {
    try {
      const client = await this.prisma.client.create({
        data: {
          phone: dto.phone,
          name: dto.name,
        },
      });

      this.logger.log(`create() | Client id=${client.id} is created`);
      return client;
    } catch (error: unknown) {
      this.logger.error(
        `create() | ${(error as Error).message}`,
        (error as Error).stack,
      );
      this.handleAccountConstraintError(error);
    }
  }

  async update(id: string, dto: UpdateClientDto): Promise<AdminReadClientDto> {
    try {
      const updatedClient = await this.prisma.client.update({
        where: { id: id },
        data: {
          ...dto,
        },
      });

      return toDto(updatedClient, AdminReadClientDto);
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `update() | ${(error as Error).message}`,
        (error as Error).stack,
      );
      this.handleAccountConstraintError(error);
    }
  }

  async refresh(refreshToken: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshClientTokenPayload>(
        refreshToken,
        {
          secret: this.refreshSecret,
        },
      );

      const client = await this.prisma.client.findUnique({
        where: {
          id: payload.sub,
        },
      });

      if (!client) {
        throw new NotFoundException('Account not found');
      }

      return this.generateAccessToken(client);
    } catch (e: unknown) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      this.logger.warn(`refresh() | Invalid refresh token`);
      throw new BadRequestException('Invalid or expired refresh token');
    }
  }

  async sendCode(phone: string, type: SendCodeType) {
    const validPhone = this.validatePhoneNumber(phone);
    try {
      const client = await this.prisma.client.findUnique({
        where: { phone: validPhone },
      });

      if (!client) {
        const newClient = await this.create({ phone: validPhone, name: '' });

        this.logger.log(
          `sendCode() | New client created for phone=${validPhone} | id=${newClient.id}`,
        );
      }

      return await this.notificationService.sendAuthCode(validPhone, type);
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        throw error;
      }

      this.logger.error(
        `sendCode() | Error sending code to ${validPhone}: ${(error as Error).message}`,
        (error as Error).stack,
      );

      this.handleAccountConstraintError(error);
    }
  }

  async loginByCode(target: string, code: string): Promise<Client> {
    try {
      const client = await this.prisma.client.findUnique({
        where: { phone: target },
      });

      if (!client) {
        this.logger.error(`loginByCode() | Client not found | phone=${target}`);
        throw new NotFoundException('Client not found after code verification');
      }

      await this.checkAuthCode(target, code);

      this.logger.log(`loginByCode() | Client logged in | id=${client.id}`);
      return client;
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `loginByCode() | Unexpected error | ${(error as Error).message}`,
        (error as Error).stack,
      );

      throw new BadRequestException('Failed to login by code');
    }
  }

  async checkAuthCode(target: string, code: string) {
    try {
      const codeMessage = await this.prisma.authMessage.findFirst({
        where: { target: target, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
      if (!codeMessage) {
        this.logger.warn(
          `checkAuthCode() | No PENDING code found for ${target}`,
        );
        throw new ForbiddenException('Code not found or already used');
      }

      if (code === codeMessage?.code) {
        await this.prisma.authMessage.update({
          where: { id: codeMessage.id },
          data: { status: 'VERIFIED' },
        });
        return;
      }
      const currentAttempts = codeMessage.attemptsCount + 1;
      const isFailed = currentAttempts >= 3;

      await this.prisma.authMessage.update({
        where: { id: codeMessage.id },
        data: {
          attemptsCount: currentAttempts,
          status: isFailed ? 'FAILED' : 'PENDING',
        },
      });

      if (isFailed) {
        this.logger.warn(
          `checkAuthCode() | Max attempts reached for ${target}`,
        );
      }

      throw new ForbiddenException('Invalid verification code');
    } catch (error) {
      this.logger.error(`checkAuthCode() failed: ${(error as Error).message}`);
      throw error;
    }
  }

  validatePhoneNumber(number: string): string {
    const defaultCountry: CountryCode = 'RU';
    try {
      const phoneNumber: PhoneNumber = parsePhoneNumberWithError(
        number,
        defaultCountry,
      );

      if (!phoneNumber.isValid()) {
        throw new Error('Number is not valid for the detected country');
      }

      this.logger.log(`Phone validated: ${phoneNumber.number}`);

      return phoneNumber.number;
    } catch (error) {
      const message = (error as Error).message;
      this.logger.warn(`Phone validation failed for "${number}": ${message}`);

      throw new InvalidPhoneNumberException(message);
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.client.update({
        where: { id: id },
        data: { deletedAt: new Date() },
      });
      this.logger.log(`softDelete() | Client soft-deleted | id=${id}`);
    } catch (error) {
      this.logger.error(
        `softDelete() | Error | id=${id}`,
        (error as Error).stack,
      );

      this.handleAccountConstraintError(error);
    }
  }

  async generateAccessToken(client: Client): Promise<string> {
    const payload: AccessClientTokenPayload = {
      phone: client.phone,
      sub: client.id,
    };

    return this.jwt.signAsync(payload, {
      expiresIn: this.accessTtl,
      secret: this.accessSecret,
    });
  }

  async generateRefreshToken(client: Client): Promise<string> {
    const payload: RefreshClientTokenPayload = {
      sub: client.id,
      phone: client.phone,
    };
    return this.jwt.signAsync(payload, {
      expiresIn: this.refreshTtl,
      secret: this.refreshSecret,
    });
  }

  setRefreshCookie(res: Response, token: string): void {
    const refreshMaxAge = this.refreshTtl * 1000;

    res.cookie('client_refresh_token', token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: refreshMaxAge,
    });
  }

  private handleAccountConstraintError(error: unknown): never {
    if (error instanceof DomainException) {
      throw error;
    }

    if (!isPrismaError(error)) {
      throw error as Error;
    }

    const internalCode = getInternalErrorCode(error);
    const modelName = getPrismaModelName(error);

    if (internalCode === PrismaErrorCode.RECORD_NOT_FOUND) {
      throw new NotFoundException('Record not found');
    }

    if (internalCode === PrismaErrorCode.UNIQUE_VIOLATION) {
      if (modelName === 'Client') {
        throw new PhoneAlreadyExistsException();
      }
      throw new DuplicateValueException();
    }

    throw new BadRequestException('Database operation failed');
  }
}
