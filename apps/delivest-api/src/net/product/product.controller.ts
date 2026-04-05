import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ProductService } from './product.service.js';
import { ReadProductDto } from './dto/read.dto.js';
import { GetProductDto } from './dto/find.dto.js';
import { FindProductsByNameDto } from './dto/find-by-name.dto.js';
import { GetProductsByBranchDto } from './dto/find-by-branch.dto.js';
import { GetProductsByCategoryDto } from './dto/find-by-category.dto.js';

@ApiTags('Product (Товары)')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('branch/:branchId')
  @ApiParam({ name: 'branchId', description: 'айди филиала' })
  @ApiOperation({ summary: 'Получить все товары по айди филиала' })
  @ApiOkResponse({ type: [ReadProductDto] })
  @ApiNotFoundResponse({ description: 'Товары не найдены' })
  async getAllProductsByBranch(@Param() dto: GetProductsByBranchDto) {
    return this.productService.findAllByBranch(dto.branchId);
  }

  @Get('category/:categoryId')
  @ApiParam({ name: 'categoryId', description: 'айди категории' })
  @ApiOperation({ summary: 'Получить все товары по айди категории' })
  @ApiOkResponse({ type: [ReadProductDto] })
  @ApiNotFoundResponse({ description: 'Товары не найдены' })
  async getAllProductsByCategory(@Param() dto: GetProductsByCategoryDto) {
    return this.productService.findAllByCategory(dto.categoryId);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'айди товара' })
  @ApiOperation({ summary: 'Получить один товар по айди' })
  @ApiOkResponse({ type: ReadProductDto })
  @ApiNotFoundResponse({ description: 'Товар не найден' })
  async getProduct(@Param() dto: GetProductDto) {
    return this.productService.findOne(dto.id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Поиск товара' })
  @ApiOkResponse({ type: [ReadProductDto] })
  @ApiNotFoundResponse({ description: 'Товар не найден' })
  async findProduct(@Query() dto: FindProductsByNameDto) {
    return this.productService.findByName(dto.branchId, dto.name);
  }
}
