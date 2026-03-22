import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

import {
  BadRequestException,
  DomainException,
  NotFoundException,
} from '../../shared/exception/domain_exception/domain-exception.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadCategoryDto } from './dto/read-category.dto.js';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);
  constructor(private readonly prisma: PrismaService) {}

  async findAll(branchId: string): Promise<ReadCategoryDto[]> {
    try {
      const categories = await this.prisma.category.findMany({
        where: { branchId: branchId },
      });
      if (categories.length === 0) {
        throw new NotFoundException();
      }
      return categories.map((category) => toDto(category, ReadCategoryDto));
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findAll() | error find all branch ${(error as Error).stack}`,
      );
      throw new BadRequestException();
    }
  }

  async findOne(dto: GetBranchDto): Promise<ReadBranchDto> {
    try {
      const branch = await this.prisma.branch.findUnique({
        where: {
          id: dto.id,
        },
      });
      if (!branch) {
        throw new NotFoundException();
      }
      return toDto(branch, ReadBranchDto);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findOne() | error find branch ${dto.id} info ${(error as Error).stack}`,
      );
      throw new BadRequestException();
    }
  }

  async getBranchDetails(dto: GetBranchDto): Promise<ReadBranchDetailsDto> {
    try {
      const branchDetails = await this.prisma.branchInfo.findUnique({
        where: {
          branchId: dto.id,
        },
      });
      if (!branchDetails) {
        throw new NotFoundException();
      }
      return toDto(branchDetails, ReadBranchDetailsDto);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `getInfo() | error get branch ${dto.id} info ${(error as Error).stack}`,
      );
      throw new BadRequestException();
    }
  }
}
