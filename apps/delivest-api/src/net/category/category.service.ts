import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  BadRequestException,
  DomainException,
  DuplicateValueException,
  NotFoundException,
} from '../../shared/exceptions/domain_exception/domain-exception.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadCategoryDto } from './dto/read.dto.js';
import { AdminReadCategoryDto } from './dto/admin-read.dto.js';
import { CreateCategoryDto } from './dto/create.dto.js';
import { PrismaErrorCode } from '@delivest/common';
import {
  getInternalErrorCode,
  getPrismaModelName,
  isPrismaError,
} from '../../shared/helpers/db-errors.js';
import { UpdateCategoryDto } from './dto/update.dto.js';
import { IdentityService } from '../../identify/identify.service.js';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma/dist/src/lib/transactional-adapter-prisma.js';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { TransactionHost } from '@nestjs-cls/transactional/dist/src/lib/transaction-host.js';
import { type AccessStaffTokenPayload } from '@delivest/types';
import { Transactional } from '@nestjs-cls/transactional';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityService: IdentityService,
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
  ) {}

  async findAllByBranch(branchId: string): Promise<ReadCategoryDto[]>;
  async findAllByBranch(
    branchId: string,
    extended: true,
  ): Promise<AdminReadCategoryDto[]>;
  async findAllByBranch(
    branchId: string,
    extended?: boolean,
  ): Promise<ReadCategoryDto[] | AdminReadCategoryDto[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: { branchId: branchId, deletedAt: null },
      });
      if (categories.length === 0) {
        throw new NotFoundException();
      }
      return categories.map((category) =>
        extended
          ? toDto(category, AdminReadCategoryDto)
          : toDto(category, ReadCategoryDto),
      );
    } catch (error) {
      if (error instanceof DomainException) throw error;
      this.logger.error(
        `findAllByBranch() failed | branchId: ${branchId} | error: ${(error as Error).message}`,
      );
      throw new BadRequestException();
    }
  }

  async findOne(categoryId: string): Promise<ReadCategoryDto>;
  async findOne(
    categoryId: string,
    extended: true,
  ): Promise<AdminReadCategoryDto>;
  async findOne(
    categoryId: string,
    extended?: boolean,
  ): Promise<ReadCategoryDto | AdminReadCategoryDto> {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        throw new NotFoundException();
      }
      return extended
        ? toDto(category, AdminReadCategoryDto)
        : toDto(category, ReadCategoryDto);
    } catch (error) {
      if (error instanceof DomainException) throw error;
      this.logger.error(
        `findOne() failed | categoryId: ${categoryId} | error: ${(error as Error).message}`,
      );
      throw new BadRequestException();
    }
  }

  @Transactional()
  async update(
    dto: UpdateCategoryDto,
    staffToken?: AccessStaffTokenPayload,
  ): Promise<AdminReadCategoryDto> {
    try {
      const { categoryId, ...data } = dto;

      const updatedCategory = await this.txHost.tx.category.update({
        where: { id: categoryId },
        data: data,
      });

      if (staffToken) {
        this.identityService.checkBranchAbility(
          staffToken,
          updatedCategory.branchId,
        );
      }

      this.logger.log(
        `update() success | Category updated | id: ${dto.categoryId}`,
      );
      return toDto(updatedCategory, AdminReadCategoryDto);
    } catch (error) {
      this.logger.error(
        `update() failed | id: ${dto.categoryId} | error: ${(error as Error).message}`,
      );
      this.handleProductConstraintError(error);
    }
  }

  async create(
    dto: CreateCategoryDto,
    staffToken?: AccessStaffTokenPayload,
  ): Promise<AdminReadCategoryDto> {
    try {
      if (staffToken) {
        this.identityService.checkBranchAbility(staffToken, dto.branchId);
      }
      const newCategory = await this.txHost.tx.category.create({
        data: { ...dto },
      });

      this.logger.log(
        `create() success | Category created | id: ${newCategory.id} | branchId: ${dto.branchId}`,
      );
      return toDto(newCategory, AdminReadCategoryDto);
    } catch (error) {
      this.logger.error(
        `create() failed | branchId: ${dto.branchId} | error: ${(error as Error).message}`,
      );
      this.handleProductConstraintError(error);
    }
  }

  @Transactional()
  async softDelete(
    id: string,
    staffToken?: AccessStaffTokenPayload,
  ): Promise<void> {
    try {
      const category = await this.txHost.tx.category.findUnique({
        where: { id: id },
      });

      if (staffToken && category) {
        this.identityService.checkBranchAbility(staffToken, category?.branchId);
      }

      await this.txHost.tx.category.update({
        where: { id: id },
        data: { deletedAt: new Date() },
      });

      this.logger.log(
        `softDelete() success | Category soft-deleted | id: ${id}`,
      );
    } catch (error) {
      this.logger.error(
        `softDelete() failed | id: ${id} | error: ${(error as Error).message}`,
      );
      this.handleProductConstraintError(error);
    }
  }

  private handleProductConstraintError(error: unknown): never {
    if (error instanceof DomainException) {
      throw error;
    }

    if (!isPrismaError(error)) {
      this.logger.error(`Unexpected DB error: ${(error as Error).stack}`);
      throw error;
    }

    const internalCode = getInternalErrorCode(error);
    const modelName = getPrismaModelName(error);

    if (internalCode === PrismaErrorCode.RECORD_NOT_FOUND) {
      throw new NotFoundException(`${modelName || 'Record'} not found`);
    }

    if (internalCode === PrismaErrorCode.UNIQUE_VIOLATION) {
      if (modelName === 'Category') {
        throw new BadRequestException(
          'Category with this name already exists in this branch',
        );
      }
      throw new DuplicateValueException();
    }

    throw new BadRequestException('Database operation failed');
  }
}
