import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

import {
  BadRequestException,
  DomainException,
  DuplicateValueException,
  NotFoundException,
} from '../../shared/exceptions/domain_exception/domain-exception.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadProductDto } from './dto/read.dto.js';
import { CreateProductDto } from './dto/create.dto.js';
import { AdminReadProductDto } from './dto/admin-read.dto.js';
import {
  getInternalErrorCode,
  getPrismaModelName,
  isPrismaError,
} from '../../shared/helpers/db-errors.js';
import { PrismaErrorCode } from '@delivest/common';
import { UpdateProductDto } from './dto/update.dto.js';
import { UploadFile } from '../../media/interface/upload-file.interface.js';
import { PhotoEditorService } from '../../media/photo-queue/photo-editor.service.js';
import { PhotoEvent } from '../../shared/events/types.js';
import { OnEvent } from '@nestjs/event-emitter';
import { PRODUCT_PHOTO_PRESETS } from '../../media/photo-configs/presets.js';
import { MediaService } from '../../media/media.service.js';
import { NotificationGateway } from '../../notification/notification.gateway.js';
import { SocketEvent } from '@delivest/types';
import type {
  PhotoConversionEvent,
  PhotoConversionFailedEvent,
  PhotoMap,
} from '../../media/interface/photo-editor-result.interface.js';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly photoEditor: PhotoEditorService,
    private readonly mediaService: MediaService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async findAllByBranch(branchId: string): Promise<ReadProductDto[]>;
  async findAllByBranch(
    branchId: string,
    extended: true,
  ): Promise<AdminReadProductDto[]>;
  async findAllByBranch(
    branchId: string,
    extended?: boolean,
  ): Promise<ReadProductDto[] | AdminReadProductDto[]> {
    try {
      const products = await this.prisma.product.findMany({
        where: { branchId, deletedAt: null },
      });

      return products.map((product) =>
        extended
          ? toDto(product, AdminReadProductDto)
          : toDto(product, ReadProductDto),
      );
    } catch (error) {
      this.logger.error(
        `findAllByBranch(${branchId}) | error: ${(error as Error).message}`,
      );
      this.handleProductConstraintError(error);
    }
  }

  async findAllByCategory(categoryId: string): Promise<ReadProductDto[]>;
  async findAllByCategory(
    categoryId: string,
    extended: true,
  ): Promise<AdminReadProductDto[]>;
  async findAllByCategory(
    categoryId: string,
    extended?: boolean,
  ): Promise<ReadProductDto[] | AdminReadProductDto[]> {
    try {
      const products = await this.prisma.product.findMany({
        where: { categoryId, deletedAt: null },
      });

      return products.map((product) =>
        extended
          ? toDto(product, AdminReadProductDto)
          : toDto(product, ReadProductDto),
      );
    } catch (error) {
      this.logger.error(
        `findAllByCategory(${categoryId}) | error: ${(error as Error).message}`,
      );
      this.handleProductConstraintError(error);
    }
  }

  async findManyByIds(ids: string[]): Promise<ReadProductDto[]>;
  async findManyByIds(
    ids: string[],
    extended: boolean,
  ): Promise<AdminReadProductDto[]>;

  async findManyByIds(
    ids: string[],
    extended?: boolean,
  ): Promise<ReadProductDto[] | AdminReadProductDto[]> {
    try {
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: ids },
          deletedAt: null,
        },
      });

      if (extended === true) {
        return products.map((product) => toDto(product, AdminReadProductDto));
      }
      return products.map((product) => toDto(product, ReadProductDto));
    } catch (error) {
      this.logger.error(
        `findManyByIds() | error find all product ${(error as Error).stack}`,
      );
      throw new BadRequestException();
    }
  }

  async findOne(productId: string): Promise<ReadProductDto>;
  async findOne(
    productId: string,
    extended: true,
  ): Promise<AdminReadProductDto>;
  async findOne(
    productId: string,
    extended?: boolean,
  ): Promise<ReadProductDto | AdminReadProductDto> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      return extended
        ? toDto(product, AdminReadProductDto)
        : toDto(product, ReadProductDto);
    } catch (error) {
      this.logger.error(
        `findOne(${productId}) | error: ${(error as Error).message}`,
      );
      this.handleProductConstraintError(error);
    }
  }

  async create(dto: CreateProductDto): Promise<AdminReadProductDto> {
    try {
      const newProduct = await this.prisma.product.create({ data: { ...dto } });
      return toDto(newProduct, AdminReadProductDto);
    } catch (error) {
      this.logger.error(
        `create() | ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.handleProductConstraintError(error);
    }
  }

  async findByName(branchId: string, name: string): Promise<ReadProductDto[]>;
  async findByName(
    branchId: string,
    name: string,
    extended: true,
  ): Promise<AdminReadProductDto[]>;
  async findByName(
    branchId: string,
    name: string,
    extended?: boolean,
  ): Promise<ReadProductDto[] | AdminReadProductDto[]> {
    try {
      const products = await this.prisma.product.findMany({
        where: {
          branchId,
          name: {
            contains: name,
            mode: 'insensitive',
          },
          deletedAt: null,
        },
      });

      return products.map((product) =>
        extended
          ? toDto(product, AdminReadProductDto)
          : toDto(product, ReadProductDto),
      );
    } catch (error) {
      this.logger.error(
        `findByName(${name}) in branch ${branchId} | error: ${
          (error as Error).message
        }`,
      );
      this.handleProductConstraintError(error);
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.product.update({
        where: { id: id },
        data: { deletedAt: new Date() },
      });
      this.logger.log(`softDelete() | Product soft-deleted | id=${id}`);
    } catch (error) {
      this.logger.error(
        `softDelete() | Error | id=${id}`,
        (error as Error).stack,
      );

      this.handleProductConstraintError(error);
    }
  }

  async update(
    productId: string,
    dto: UpdateProductDto,
  ): Promise<AdminReadProductDto> {
    try {
      const updatedProduct = await this.prisma.product.update({
        where: { id: productId },
        data: {
          ...dto,
        },
      });

      return toDto(updatedProduct, AdminReadProductDto);
    } catch (error) {
      this.logger.error(
        `update(${productId}) | error: ${(error as Error).message}`,
        (error as Error).stack,
      );

      this.handleProductConstraintError(error);
    }
  }

  async updatePhoto(
    file: UploadFile,
    productId: string,
    socketId: string,
  ): Promise<void> {
    try {
      await this.photoEditor.uploadAndEditMultiple(
        productId,
        file,
        PRODUCT_PHOTO_PRESETS,
        socketId,
        PhotoEvent.PRODUCT_PHOTO_CONVERTED,
        PhotoEvent.PRODUCT_PHOTO_CONVERSION_FAILED,
      );
    } catch (error) {
      this.logger.error(
        `updatePhoto() | Error updating photo for product ${productId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  @OnEvent(PhotoEvent.PRODUCT_PHOTO_CONVERTED)
  async handleProductPhotoBatch(payload: PhotoConversionEvent) {
    const { targetId, socketId, photos } = payload;

    try {
      const existingProduct = await this.prisma.product.findUnique({
        where: { id: targetId },
        select: { photos: true },
      });

      const updatedProduct = await this.prisma.product.update({
        where: { id: targetId },
        data: {
          photos,
        },
      });

      if (existingProduct?.photos) {
        const oldPhotos = existingProduct.photos as PhotoMap;
        const newKeys = new Set(Object.values(photos));

        const keysToDelete = Object.values(oldPhotos).filter(
          (oldKey) => oldKey && !newKeys.has(oldKey),
        );

        if (keysToDelete.length > 0) {
          await this.mediaService.deleteFilesByKeys(keysToDelete);
          this.logger.log(
            `Deleted ${keysToDelete.length} old photos for product ${targetId}`,
          );
        }
      }

      this.notificationGateway.server
        .to(socketId)
        .emit(SocketEvent.PHOTO_EDIT_RESULT, {
          success: true,
          targetId,
          photos: updatedProduct.photos,
        });
    } catch (error) {
      this.logger.error(`Failed to handle photo batch for ${targetId}`, error);
    }
  }

  @OnEvent(PhotoEvent.PRODUCT_PHOTO_CONVERSION_FAILED)
  handlePhotoConversionFailedEvent(event: PhotoConversionFailedEvent) {
    const { fileId, error } = event;

    this.logger.error(
      `Photo conversion failed File: ${fileId}. Error: ${error}`,
    );
  }
  handleProductConstraintError(error: unknown): never {
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
      if (modelName === 'Product') {
        throw new BadRequestException(
          'Product with this name already exists in this branch',
        );
      }
      throw new DuplicateValueException();
    }

    throw new BadRequestException('Database operation failed');
  }
}
