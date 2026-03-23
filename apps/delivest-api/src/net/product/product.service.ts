import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

import {
  BadRequestException,
  DomainException,
  NotFoundException,
} from '../../shared/exception/domain_exception/domain-exception.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadProductDto } from './dto/read-product.dto.js';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  constructor(private readonly prisma: PrismaService) {}

  async findAllByBranch(branchId: string): Promise<ReadProductDto[]> {
    try {
      const products = await this.prisma.product.findMany({
        where: { branchId: branchId },
      });
      if (products.length === 0) {
        throw new NotFoundException();
      }
      return products.map((product) => toDto(product, ReadProductDto));
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findAllByBranch() | error find all products by branch ${branchId} ${(error as Error).stack}`,
      );
      throw new BadRequestException();
    }
  }

  async findAllByCategory(categoryId: string): Promise<ReadProductDto[]> {
    try {
      const products = await this.prisma.product.findMany({
        where: { categoryId: categoryId },
      });
      if (products.length === 0) {
        throw new NotFoundException();
      }
      return products.map((product) => toDto(product, ReadProductDto));
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findAllByCategory() | error find all products by category ${categoryId} ${(error as Error).stack}`,
      );
      throw new BadRequestException();
    }
  }

  async findOne(productId: string): Promise<ReadProductDto> {
    try {
      const product = await this.prisma.product.findUnique({
        where: {
          id: productId,
        },
      });
      if (!product) {
        throw new NotFoundException();
      }
      return toDto(product, ReadProductDto);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findOne() | error find product ${productId}  ${(error as Error).stack}`,
      );
      throw new BadRequestException();
    }
  }

  async findByName(branchId: string, name: string): Promise<ReadProductDto[]> {
    try {
      const products = await this.prisma.product.findMany({
        where: {
          branchId: branchId,
          name: {
            contains: name,
          },
        },
      });
      if (products.length === 0) {
        throw new NotFoundException();
      }
      return products.map((product) => toDto(product, ReadProductDto));
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `findByName() | error find products by name ${name} in branch ${branchId} ${(error as Error).stack}`,
      );
      throw new BadRequestException();
    }
  }
}
