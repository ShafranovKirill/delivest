import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ReadCategoryDto } from './dto/read-category.dto.js';
import { CategoryService } from './category.service.js';
import { GetCategoryByBranchDto } from './dto/get-category-by-branch.dto.js';
import { GetCategoryDto } from './dto/get-category.dto.js';

@ApiTags('Category (Категории)')
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get('filial/:branchId')
  @ApiOperation({ summary: 'Получить все категории по айди филиала' })
  @ApiOkResponse({ type: ReadCategoryDto })
  @ApiNotFoundResponse({ description: 'Категории не найдены' })
  async getAllCategory(@Param() dto: GetCategoryByBranchDto) {
    return this.categoryService.findAllByBranch(dto.branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить одну категорию по айди' })
  @ApiOkResponse({ type: ReadCategoryDto })
  @ApiNotFoundResponse({ description: 'Категория не найдена' })
  async getCategory(@Param() dto: GetCategoryDto) {
    return this.categoryService.findOne(dto.id);
  }
}
