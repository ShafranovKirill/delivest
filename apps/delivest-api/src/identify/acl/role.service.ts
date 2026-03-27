import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  BadRequestException,
  DomainException,
  DuplicateValueException,
  NotFoundException,
} from '../../shared/exception/domain_exception/domain-exception.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadRoleDto } from './dto/read-role.dto.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import {
  getInternalErrorCode,
  isPrismaError,
} from '../../shared/helpers/db-errors.js';
import { PrismaErrorCode } from '@delivest/common';
import { UpdateRoleDto } from './dto/update-role.dto.js';

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ReadRoleDto> {
    const role = await this.prisma.role.findUnique({ where: { id } });

    if (!role) {
      this.logger.warn(`findById() | Role not found | id=${id}`);
      throw new NotFoundException('Role not found');
    }

    return toDto(role, ReadRoleDto);
  }

  async findAll() {
    try {
      const roles = await this.prisma.role.findMany({
        where: { deletedAt: null },
      });

      return roles.map((r) => toDto(r, ReadRoleDto));
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

  async update(id: string, dto: UpdateRoleDto): Promise<ReadRoleDto> {
    try {
      const updatedRole = await this.prisma.role.update({
        where: { id: id },
        data: {
          ...dto,
        },
      });

      return toDto(updatedRole, ReadRoleDto);
    } catch (error: unknown) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `update() | ${(error as Error).message}`,
        (error as Error).stack,
      );
      this.handleRoleConstraintError(error);
    }
  }

  async create(dto: CreateRoleDto): Promise<ReadRoleDto> {
    this.logger.log(`create() | name=${dto.name}`);

    try {
      this.logger.debug(
        `create() | Creating role with data: ${JSON.stringify(dto)}`,
      );
      const role = await this.prisma.role.create({
        data: {
          name: dto.name,
          permissions: dto.permissions ?? [],
        },
      });

      this.logger.log(`create() | Role created | id=${role.id}`);
      return toDto(role, ReadRoleDto);
    } catch (error: unknown) {
      this.logger.error(
        `create() | ${(error as Error).message}`,
        (error as Error).stack,
      );

      this.handleRoleConstraintError(error);
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.role.update({
        where: { id: id },
        data: { deletedAt: new Date() },
      });
      this.logger.log(`softDelete() | Role soft-deleted | id=${id}`);
    } catch (error) {
      this.logger.error(
        `softDelete() | Error delete role | id=${id}`,
        (error as Error).stack,
      );

      this.handleRoleConstraintError(error);
    }
  }

  private handleRoleConstraintError(error: unknown): never {
    if (error instanceof DomainException) {
      throw error;
    }

    if (!isPrismaError(error)) {
      throw error as Error;
    }

    const internalCode = getInternalErrorCode(error);

    if (internalCode === PrismaErrorCode.RECORD_NOT_FOUND) {
      throw new NotFoundException('Role not found');
    }

    if (internalCode === PrismaErrorCode.UNIQUE_VIOLATION) {
      throw new DuplicateValueException('Role with this name already exists');
    }

    throw new BadRequestException('Role operation failed');
  }
}
