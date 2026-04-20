import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service.js';
import { Permission } from '../../../generated/prisma/enums.js';
import { CreateCategoryDto } from './dto/create.dto.js';
import { AdminReadCategoryDto } from './dto/admin-read.dto.js';
import { JwtStaffAuthGuard } from '../../identify/index.js';
import { AclGuard } from '../../identify/acl/guards/acl.guard.js';
import { RequirePermission } from '../../identify/acl/decorators/require-permission.decorator.js';
import { UpdateCategoryDto } from './dto/update.dto.js';
import { CurrentStaff } from '../../shared/decorators/current-staff.decorator.js';
import { type AccessStaffTokenPayload } from '@delivest/types';

@ApiTags('Admin-category (Категории-crm)')
@Controller('admin/category')
@ApiBearerAuth('staff-auth')
@UseGuards(JwtStaffAuthGuard, AclGuard)
export class AdminCategoryController {
  constructor(private readonly service: CategoryService) {}

  @Post('create')
  @ApiOperation({ summary: 'Создать категорию' })
  @RequirePermission(Permission.CATEGORY_CREATE)
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentStaff() staff: AccessStaffTokenPayload,
  ): Promise<AdminReadCategoryDto> {
    return await this.service.create(dto, staff);
  }

  @Get('by-branch/:branchId')
  @ApiOperation({ summary: 'Получить все категории филиала (расширенные)' })
  @RequirePermission(Permission.CATEGORY_READ)
  async findAllByBranch(
    @Param('branchId') branchId: string,
  ): Promise<AdminReadCategoryDto[]> {
    return await this.service.findAllByBranch(branchId, true);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Обновить категорию' })
  @RequirePermission(Permission.CATEGORY_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentStaff() staff?: AccessStaffTokenPayload,
  ): Promise<AdminReadCategoryDto> {
    return await this.service.update({ ...dto, categoryId: id }, staff);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить категорию по ID' })
  @RequirePermission(Permission.CATEGORY_READ)
  async findOne(@Param('id') id: string): Promise<AdminReadCategoryDto> {
    return await this.service.findOne(id, true);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Мягкое удаление категории' })
  @RequirePermission(Permission.CATEGORY_DELETE)
  async softDelete(
    @Param('id') id: string,
    @CurrentStaff() staff: AccessStaffTokenPayload,
  ): Promise<void> {
    return await this.service.softDelete(id, staff);
  }
}
