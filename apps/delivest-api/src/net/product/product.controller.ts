import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ProductService } from './product.service.js';
import { ReadProductDto } from './dto/read-product.dto.js';
import { GetProductDto } from './dto/get-product.dto.js';
import { FindProductsDto } from './dto/find-products.dto.js';
import { GetProductsByBranchDto } from './dto/get-product-by-branch.dto.js';
import { GetProductsByCategoryDto } from './dto/get-product-by-category.dto.js';

@ApiTags('Product (Товары)')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('branch/:id')
  @ApiParam({ name: 'branchId', description: 'айди филиала' })
  @ApiOperation({ summary: 'Получить все товары по айди филиала' })
  @ApiOkResponse({ type: ReadProductDto })
  @ApiNotFoundResponse({ description: 'Категории не найдены' })
  async getAllProductsByBranch(@Param() dto: GetProductsByBranchDto) {
    return this.productService.findAllByBranch(dto.branchId);
  }

  @Get('category/:id')
  @ApiParam({ name: 'categoryId', description: 'айди категории' })
  @ApiOperation({ summary: 'Получить все товары по айди категории' })
  @ApiOkResponse({ type: ReadProductDto })
  @ApiNotFoundResponse({ description: 'Категории не найдены' })
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
  @ApiOkResponse({ type: ReadProductDto })
  @ApiNotFoundResponse({ description: 'Товар не найден' })
  async findProduct(@Query() dto: FindProductsDto) {
    return this.productService.findByName(dto.branchId, dto.name);
  }
}
