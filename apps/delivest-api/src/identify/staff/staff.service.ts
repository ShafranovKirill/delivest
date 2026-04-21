import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReadStaffDto } from './dto/read.dto.js';
import * as argon2 from 'argon2';
import {
  BadRequestException,
  DomainException,
  DuplicateValueException,
  InvalidCredentialsException,
  NotFoundException,
  RegistrationFailedException,
  UserAlreadyExistsException,
  UserNotFoundException,
  UserNotRegisteredException,
} from '../../shared/exceptions/domain_exception/domain-exception.js';
import { toDto } from '../../utils/to-dto.js';
import { CreateStaffDto } from './dto/create.dto.js';
import { Staff } from '../../../generated/prisma/client.js';
import {
  getInternalErrorCode,
  getPrismaModelName,
  isPrismaError,
} from '../../shared/helpers/db-errors.js';
import { COOKIE_NAMES, PrismaErrorCode } from '@delivest/common';
import {
  AccessStaffTokenPayload,
  RefreshStaffTokenPayload,
} from '@delivest/types';
import { RoleService } from '../acl/role.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginStaffDto } from './dto/login.dto.js';
import { Response } from 'express';
import { UpdateStaffDto } from './dto/update.dto.js';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly roleService: RoleService,
  ) {
    this.accessTtl = +this.config.get<number>(
      'JWT_ACCESS_TTL_SECONDS_STAFF',
      900,
    );
    this.refreshTtl = +this.config.get<number>(
      'JWT_REFRESH_TTL_SECONDS_STAFF',
      604800,
    );
    this.accessSecret = this.config.get<string>('JWT_ACCESS_SECRET_STAFF', '');
    this.refreshSecret = this.config.get<string>(
      'JWT_REFRESH_SECRET_STAFF',
      '',
    );
  }

  async findOne(id: string): Promise<ReadStaffDto> {
    try {
      const staff = await this.prisma.staff.findUnique({
        where: { id: id },
        include: { branches: true },
      });

      if (!staff) {
        this.logger.warn(`findOne() | <staff> not found | id=${id}`);
        throw new UserNotFoundException('Staff not found');
      }
      const staffWithIds = {
        ...staff,
        branchIds: staff.branches.map((b) => b.branchId),
      };

      return toDto(staffWithIds, ReadStaffDto);
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findOne() | ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new BadRequestException('Failed to fetch staff');
    }
  }

  async findOneByLogin(login: string): Promise<ReadStaffDto> {
    try {
      const staff = await this.prisma.staff.findUnique({
        where: { login: login },
        include: { branches: true },
      });

      if (!staff) {
        this.logger.warn(`findOneByLogin() | Staff not found | login=${login}`);
        throw new UserNotFoundException('Staff not found');
      }

      const staffWithIds = {
        ...staff,
        branchIds: staff.branches.map((b) => b.branchId),
      };

      return toDto(staffWithIds, ReadStaffDto);
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findOneByPhone() | ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new BadRequestException('Failed to fetch staff');
    }
  }

  async findAll(): Promise<ReadStaffDto[]> {
    try {
      const staff = await this.prisma.staff.findMany({
        where: { deletedAt: null },
        include: { branches: true },
      });

      return staff.map((s) => {
        const staffWithIds = {
          ...s,
          branchIds: s.branches.map((b) => b.branchId),
        };
        return toDto(staffWithIds, ReadStaffDto);
      });
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findAll() | ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new BadRequestException('Failed to fetch staff');
    }
  }

  async create(dto: CreateStaffDto): Promise<ReadStaffDto> {
    try {
      const passwordHash = await argon2.hash(dto.password);
      const staff = await this.prisma.staff.create({
        data: {
          login: dto.login,
          passwordHash: passwordHash,
          roleId: dto.roleId,
          name: dto.name,
          branches: {
            createMany: {
              data: dto.branchIds.map((id) => ({ branchId: id })),
            },
          },
        },
        include: { branches: true },
      });

      this.logger.log(`create() | Staff id=${staff.id} is created`);
      return toDto(staff, ReadStaffDto);
    } catch (error: unknown) {
      this.logger.error(
        `create() | ${(error as Error).message}`,
        (error as Error).stack,
      );
      this.handleAccountConstraintError(error);
    }
  }

  async update(dto: UpdateStaffDto): Promise<ReadStaffDto> {
    try {
      const { branchIds, ...updateData } = dto;

      const updatedStaff = await this.prisma.staff.update({
        where: { id: dto.id },
        data: {
          ...updateData,
          ...(branchIds && {
            branches: {
              deleteMany: {},
              createMany: {
                data: branchIds.map((branchId) => ({ branchId })),
              },
            },
          }),
        },
        include: {
          branches: true,
        },
      });

      return toDto(updatedStaff, ReadStaffDto);
    } catch (error: unknown) {
      if (error instanceof DomainException) throw error;
      this.logger.error(
        `update() | ${(error as Error).message}`,
        (error as Error).stack,
      );
      this.handleAccountConstraintError(error);
    }
  }

  async refresh(refreshToken: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshStaffTokenPayload>(
        refreshToken,
        {
          secret: this.refreshSecret,
        },
      );

      const staff = await this.prisma.staff.findUnique({
        where: {
          id: payload.sub,
        },
      });

      if (!staff) {
        throw new NotFoundException('Account not found');
      }

      return this.generateAccessToken(staff);
    } catch (e: unknown) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      this.logger.warn(`refresh() | Invalid refresh token`);
      throw new BadRequestException('Invalid or expired refresh token');
    }
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    const staff = await this.prisma.staff.findUnique({
      where: {
        id: id,
      },
    });
    if (!staff) throw new NotFoundException('Account not found');

    if (!staff.passwordHash) {
      throw new UserNotRegisteredException();
    }
    const isOldValid = await argon2.verify(staff.passwordHash, dto.oldPassword);
    if (!isOldValid) {
      this.logger.warn(`changePassword() | Invalid old password | id=${id}`);
      throw new ForbiddenException('Invalid old password');
    }

    const newPassword = await argon2.hash(dto.newPassword);

    await this.prisma.staff.update({
      where: { id: id },
      data: { passwordHash: newPassword },
    });
    this.logger.log(`changePassword() | Staff id=${id} changed password`);
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.staff.update({
        where: { id: id },
        data: { deletedAt: new Date() },
      });
      this.logger.log(`softDelete() | Staff soft-deleted | id=${id}`);
    } catch (error) {
      this.logger.error(
        `softDelete() | Error | id=${id}`,
        (error as Error).stack,
      );

      this.handleAccountConstraintError(error);
    }
  }

  async validateCredentials(dto: LoginStaffDto): Promise<Staff> {
    const staff = await this.prisma.staff.findUnique({
      where: { login: dto.login },
    });
    if (!staff) {
      throw new NotFoundException();
    }
    if (!staff.passwordHash) {
      throw new UserNotRegisteredException();
    }
    const isPasswordValid = await argon2.verify(
      staff.passwordHash,
      dto.password,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }
    return staff;
  }

  async generateAccessToken(staff: Staff): Promise<string> {
    const role = await this.roleService.findById(staff.roleId);
    const branchIds = await this.getStaffsBranches(staff.id);
    const payload: AccessStaffTokenPayload = {
      login: staff.login,
      sub: staff.id,
      roleId: staff.roleId,
      permissions: role.permissions,
      branchIds,
    };

    return this.jwt.signAsync(payload, {
      expiresIn: this.accessTtl,
      secret: this.accessSecret,
    });
  }

  async generateRefreshToken(staff: Staff): Promise<string> {
    const payload: RefreshStaffTokenPayload = {
      login: staff.login,
      sub: staff.id,
    };
    return this.jwt.signAsync(payload, {
      expiresIn: this.refreshTtl,
      secret: this.refreshSecret,
    });
  }

  setRefreshCookie(res: Response, token: string): void {
    const refreshMaxAge = this.refreshTtl * 1000;

    res.cookie(COOKIE_NAMES.STAFF_REFRESH_TOKEN, token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: refreshMaxAge,
    });
  }

  private async getStaffsBranches(staffId: string): Promise<string[]> {
    const staffBranches = await this.prisma.staffBranch.findMany({
      where: { staffId: staffId },
      select: { branchId: true },
    });
    return staffBranches.map((sb) => sb.branchId);
  }

  private handleAccountConstraintError(error: unknown): never {
    if (!isPrismaError(error)) {
      throw new RegistrationFailedException();
    }
    const internalCode = getInternalErrorCode(error);
    const modelName = getPrismaModelName(error);

    if (internalCode === PrismaErrorCode.RECORD_NOT_FOUND) {
      throw new NotFoundException('Record not found');
    }
    if (internalCode === PrismaErrorCode.UNIQUE_VIOLATION) {
      if (modelName === 'Staff') {
        throw new UserAlreadyExistsException();
      }
      throw new DuplicateValueException();
    }

    if (internalCode === PrismaErrorCode.FOREIGN_KEY_VIOLATION) {
      throw new NotFoundException();
    }

    throw new BadRequestException();
  }
}
