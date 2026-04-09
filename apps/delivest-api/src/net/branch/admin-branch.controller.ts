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
import { BranchService } from './branch.service.js';
import { Permission } from '../../../generated/prisma/enums.js';
import { CreateBranchDto } from './dto/create.dto.js';
import { AdminReadBranchDto } from './dto/admin-read.dto.js';
import { JwtStaffAuthGuard } from '../../identify/index.js';
import { AclGuard } from '../../identify/acl/guards/acl.guard.js';
import { RequirePermission } from '../../identify/acl/decorators/require-permission.decorator.js';
import { UpdateBranchDto } from './dto/update.dto.js';

@ApiTags('Admin-branch (Филиалы-crm)')
@Controller('admin/branch')
@ApiBearerAuth('staff-auth')
@UseGuards(JwtStaffAuthGuard, AclGuard)
export class AdminBranchController {
  constructor(private readonly service: BranchService) {}

  @Post('create')
  @ApiOperation({ summary: 'Создать филиал' })
  @RequirePermission(Permission.BRANCH_CREATE)
  async create(@Body() dto: CreateBranchDto): Promise<AdminReadBranchDto> {
    return await this.service.create(dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'Получить все филиалы' })
  @RequirePermission(Permission.BRANCH_READ)
  async findAll(): Promise<AdminReadBranchDto[]> {
    return await this.service.findAll(true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить филиал по ID с деталями' })
  @RequirePermission(Permission.BRANCH_READ)
  async findOne(@Param('id') id: string): Promise<AdminReadBranchDto> {
    return await this.service.findOne(id, true);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Обновить данные филиала' })
  @RequirePermission(Permission.BRANCH_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<AdminReadBranchDto> {
    return await this.service.update(id, dto);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Мягкое удаление филиала' })
  @RequirePermission(Permission.BRANCH_DELETE)
  async softDelete(@Param('id') id: string): Promise<void> {
    return await this.service.softDelete(id);
  }
}
