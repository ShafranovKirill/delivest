import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientService } from './client.service.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FindByPhoneDto } from './dto/find-by-phone.dto.js';
import { JwtStaffAuthGuard } from '../staff/guards/jwt-staff.guard.js';
import { AclGuard } from '../acl/guards/acl.guard.js';
import { RequirePermission } from '../acl/decorators/require-permission.decorator.js';
import { Permission } from '../../../generated/prisma/enums.js';
import { GetClientDto } from './dto/get.dto.js';
import { AdminReadClientDto } from './dto/admin-read.dto.js';
import { CreateClientDto } from './dto/create.dto.js';
import { Client } from '../../../generated/prisma/client.js';
import { UpdateClientDto } from './dto/update.dto.js';

@ApiTags('Admin-client (Клиенты-crm)')
@ApiBearerAuth('staff-auth')
@Controller('admin/client')
export class AdminClientController {
  private readonly logger = new Logger(AdminClientController.name);

  constructor(private readonly service: ClientService) {}

  @Get('all')
  @ApiOperation({ summary: 'Найти всех клиентов' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.CLIENT_READ)
  async findAll() {
    return await this.service.findAll();
  }

  @Get('find-by-phone/:phone')
  @ApiOperation({ summary: 'Найти клиента по номеру телефона' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.CLIENT_READ)
  async findByPhone(@Param() dto: FindByPhoneDto): Promise<AdminReadClientDto> {
    return await this.service.findOneByPhone(dto.phone, true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Найти клиента по айди' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.CLIENT_READ)
  async findOne(@Param() dto: GetClientDto): Promise<AdminReadClientDto> {
    return await this.service.findOne(dto.id, true);
  }

  @Post('create')
  @ApiOperation({ summary: 'Создать клиента' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.CLIENT_CREATE)
  async create(@Body() dto: CreateClientDto): Promise<Client> {
    return await this.service.create(dto);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Обновить информацию о клиенте' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.CLIENT_UPDATE)
  async update(@Param('id') id: string, @Body() updateDto: UpdateClientDto) {
    return await this.service.update(id, updateDto);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Удалить клиента' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.CLIENT_DELETE)
  async softDelete(@Param() dto: GetClientDto) {
    return await this.service.softDelete(dto.id);
  }
}
