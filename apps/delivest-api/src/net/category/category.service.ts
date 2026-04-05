import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

import {
  BadRequestException,
  DomainException,
  DuplicateValueException,
  NotFoundException,
} from '../../shared/exception/domain_exception/domain-exception.js';
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

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);
  constructor(private readonly prisma: PrismaService) {}

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
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findAllByBranch() | error find all category by branch ${branchId} ${(error as Error).stack}`,
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
        where: {
          id: categoryId,
        },
      });
      if (!category) {
        throw new NotFoundException();
      }
      return extended
        ? toDto(category, AdminReadCategoryDto)
        : toDto(category, ReadCategoryDto);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findOneByBranch() | error find category ${categoryId}  ${(error as Error).stack}`,
      );
      throw new BadRequestException();
    }
  }

  async update(
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<AdminReadCategoryDto> {
    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id: categoryId },
        data: {
          ...dto,
        },
      });

      return toDto(updatedCategory, AdminReadCategoryDto);
    } catch (error) {
      this.logger.error(
        `update(${categoryId}) | error: ${(error as Error).message}`,
        (error as Error).stack,
      );

      this.handleProductConstraintError(error);
    }
  }

  async create(dto: CreateCategoryDto): Promise<AdminReadCategoryDto> {
    try {
      const newCategory = await this.prisma.category.create({
        data: { ...dto },
      });
      return toDto(newCategory, AdminReadCategoryDto);
    } catch (error) {
      this.logger.error(
        `create() | ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.handleProductConstraintError(error);
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.category.update({
        where: { id: id },
        data: { deletedAt: new Date() },
      });
      this.logger.log(`softDelete() | Category soft-deleted | id=${id}`);
    } catch (error) {
      this.logger.error(
        `softDelete() | Error | id=${id}`,
        (error as Error).stack,
      );

      this.handleProductConstraintError(error);
    }
  }

  private handleProductConstraintError(error: unknown): never {
    if (error instanceof DomainException) {
      throw error;
    }

    if (!isPrismaError(error)) {
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
