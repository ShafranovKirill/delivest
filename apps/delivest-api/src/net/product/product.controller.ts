import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ProductService } from './product.service.js';
import { ReadProductDto } from './dto/read-product.dto.js';
import { GetProductDto } from './dto/get-product.dto.js';
import { FindProductsDto } from './dto/find-products.dto.js';

@ApiTags('Product (Товары)')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get('all/by-branch')
  @ApiOperation({ summary: 'Получить все товары по айди филиала' })
  @ApiOkResponse({ type: ReadProductDto })
  @ApiNotFoundResponse({ description: 'Категории не найдены' })
  async getAllProductsByBranch(@Query() dto: GetProductDto) {
    return this.productService.findAllByBranch(dto.id);
  }

  @Get('all/by-category')
  @ApiOperation({ summary: 'Получить все товары по айди категории' })
  @ApiOkResponse({ type: ReadProductDto })
  @ApiNotFoundResponse({ description: 'Категории не найдены' })
  async getAllProductsByCategory(@Query() dto: GetProductDto) {
    return this.productService.findAllByCategory(dto.id);
  }

  @Get('one')
  @ApiOperation({ summary: 'Получить один товар по айди' })
  @ApiOkResponse({ type: ReadProductDto })
  @ApiNotFoundResponse({ description: 'Товар не найден' })
  async getProduct(@Query() dto: GetProductDto) {
    return this.productService.findOne(dto.id);
  }

  @Get('find')
  @ApiOperation({ summary: 'Поиск товара' })
  @ApiOkResponse({ type: ReadProductDto })
  @ApiNotFoundResponse({ description: 'Товар не найден' })
  async findProduct(@Query() dto: FindProductsDto) {
    return this.productService.findByName(dto.branchId, dto.name);
  }
}
