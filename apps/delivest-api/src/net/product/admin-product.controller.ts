import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProductService } from './product.service.js';
import { Permission } from '../../../generated/prisma/enums.js';
import { CreateProductDto } from './dto/create.dto.js';
import { UpdateProductDto } from './dto/update.dto.js';
import { AdminReadProductDto } from './dto/admin-read.dto.js';
import { JwtStaffAuthGuard } from '../../identify/index.js';
import { AclGuard } from '../../identify/acl/guards/acl.guard.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermission } from '../../identify/acl/decorators/require-permission.decorator.js';

@ApiTags('Admin-product (Продукты-crm)')
@Controller('admin/product')
@ApiBearerAuth('staff-auth')
@UseGuards(JwtStaffAuthGuard, AclGuard)
export class AdminProductController {
  constructor(private readonly service: ProductService) {}

  @Post('create')
  @ApiOperation({ summary: 'Создать продукт' })
  @RequirePermission(Permission.PRODUCT_CREATE)
  async create(@Body() dto: CreateProductDto): Promise<AdminReadProductDto> {
    return await this.service.create(dto);
  }

  @Get('by-branch/:branchId')
  @ApiOperation({ summary: 'Получить все продукты филиала' })
  @RequirePermission(Permission.PRODUCT_READ)
  async findAllByBranch(
    @Param('branchId') branchId: string,
  ): Promise<AdminReadProductDto[]> {
    return await this.service.findAllByBranch(branchId, true);
  }

  @Get('by-category/:categoryId')
  @ApiOperation({ summary: 'Получить все продукты категории' })
  @RequirePermission(Permission.PRODUCT_READ)
  async findAllByCategory(
    @Param('categoryId') categoryId: string,
  ): Promise<AdminReadProductDto[]> {
    return await this.service.findAllByCategory(categoryId, true);
  }

  @Get('search')
  @ApiOperation({ summary: 'Поиск продукта по имени в филиале' })
  @RequirePermission(Permission.PRODUCT_READ)
  async findByName(
    @Query('branchId') branchId: string,
    @Query('name') name: string,
  ): Promise<AdminReadProductDto[]> {
    return await this.service.findByName(branchId, name, true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить продукт по ID' })
  @RequirePermission(Permission.PRODUCT_READ)
  async findOne(@Param('id') id: string): Promise<AdminReadProductDto> {
    return await this.service.findOne(id, true);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Обновить продукт' })
  @RequirePermission(Permission.PRODUCT_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<AdminReadProductDto> {
    return await this.service.update(id, dto);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Мягкое удаление продукта' })
  @RequirePermission(Permission.PRODUCT_DELETE)
  async softDelete(@Param('id') id: string): Promise<void> {
    return await this.service.softDelete(id);
  }

  @Post(':id/photo')
  @ApiOperation({
    summary: 'Загрузить или обновить фото продукта',
    description:
      'Загружает фото продукта и ставит его на обработку (resize + конвертация)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @RequirePermission(Permission.PRODUCT_UPDATE)
  async uploadPhoto(
    @Param('id') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('socketId') socketId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Файл не был загружен');
    }

    return this.service.updatePhoto(
      {
        body: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
      productId,
      socketId,
    );
  }
}
