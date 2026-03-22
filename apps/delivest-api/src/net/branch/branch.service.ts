import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

import {
  BadRequestException,
  DomainException,
  NotFoundException,
} from '../../shared/exception/domain_exception/domain-exception.js';
import { GetBranchDto } from './dto/get-branch.dto.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadBranchDto } from './dto/read-branch.dto.js';
import { ReadBranchDetailsDto } from './dto/read-branch-details.dto.js';

@Injectable()
export class BranchService {
  private readonly logger = new Logger(BranchService.name);
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    try {
      const branches = await this.prisma.branch.findMany();
      if (branches.length === 0) {
        throw new NotFoundException();
      }
      return toDto(branches, ReadBranchDto);
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
