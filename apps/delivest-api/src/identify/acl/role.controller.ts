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
import { RoleService } from './role.service.js';
import { ReadRoleDto } from './dto/read-role.dto.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtStaffAuthGuard } from '../staff/guards/jwt-staff.guard.js';
import { Permission } from '../../../generated/prisma/enums.js';
import { GetRoleDto } from './dto/get-role.dto.js';
import { RequirePermission } from '../acl/decorators/require-permission.decorator.js';
import { AclGuard } from '../acl/guards/acl.guard.js';

@ApiTags('Roles (Роли)')
@Controller('roles')
export class RoleController {
  constructor(private readonly service: RoleService) {}

  @Post()
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Создать роль' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.ROLE_CREATE)
  async create(@Body() dto: CreateRoleDto): Promise<ReadRoleDto> {
    return this.service.create(dto);
  }

  @Get('all')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Получить все активные роли' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.ROLE_READ)
  async findAll(): Promise<ReadRoleDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Найти роль по ID' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.ROLE_READ)
  async findOne(@Param() dto: GetRoleDto): Promise<ReadRoleDto> {
    return this.service.findById(dto.id);
  }

  @Patch(':id')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Обновить данные роли' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.ROLE_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<ReadRoleDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Удалить роль (soft delete)' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.ROLE_DELETE)
  async remove(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
