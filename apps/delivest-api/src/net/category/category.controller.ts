import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ReadCategoryDto } from './dto/read.dto.js';
import { CategoryService } from './category.service.js';
import { FindCategoryDto } from './dto/find.dto.js';
import { FindCategoryByBranchDto } from './dto/find-by-branch.dto.js';

@ApiTags('Category (Категории)')
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get('filial/:branchId')
  @ApiOperation({ summary: 'Получить все категории по айди филиала' })
  @ApiOkResponse({ type: ReadCategoryDto })
  @ApiNotFoundResponse({ description: 'Категории не найдены' })
  async getAllCategory(@Param() dto: FindCategoryByBranchDto) {
    return this.categoryService.findAllByBranch(dto.branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить одну категорию по айди' })
  @ApiOkResponse({ type: ReadCategoryDto })
  @ApiNotFoundResponse({ description: 'Категория не найдена' })
  async getCategory(@Param() dto: FindCategoryDto) {
    return this.categoryService.findOne(dto.id);
  }
}
