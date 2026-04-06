/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StaffService } from './staff.service.js';
import { TokenStaffResponseDto } from './dto/token.dto.js';
import { LoginStaffDto } from './dto/login.dto.js';
import type { Request, Response } from 'express';
import { CreateStaffDto } from './dto/create.dto.js';
import { MissingTokenException } from '../../shared/exception/domain_exception/domain-exception.js';
import { JwtStaffAuthGuard } from './guards/jwt-staff.guard.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { FindByLoginDto } from './dto/find-by-login.dto.js';
import { CurrentStaff } from '../../shared/decorators/current-staff.decorator.js';
import { AclGuard } from '../acl/guards/acl.guard.js';
import { RequirePermission } from '../acl/decorators/require-permission.decorator.js';
import { Permission } from '../../../generated/prisma/enums.js';
import { GetStaffDto } from './dto/get-staff.dto.js';
import { ReadStaffDto } from './dto/read.dto.js';
import { UpdateStaffDto } from './dto/update.dto.js';
import { COOKIE_NAMES } from '@delivest/common';

@ApiTags('Staff (Работники)')
@Controller('staff')
export class StaffController {
  private readonly logger = new Logger(StaffController.name);

  constructor(private readonly service: StaffService) {}

  @Post('login')
  @ApiOperation({ summary: 'Вход' })
  @ApiOkResponse({ type: TokenStaffResponseDto })
  async login(
    @Body() dto: LoginStaffDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenStaffResponseDto> {
    const account = await this.service.validateCredentials(dto);
    const accessToken = await this.service.generateAccessToken(account);
    const refreshToken = await this.service.generateRefreshToken(account);

    this.service.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @Post('create')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Создать работника' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.STAFF_CREATE)
  async register(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: CreateStaffDto,
  ) {
    const client = await this.service.create(dto);
    const accessToken = await this.service.generateAccessToken(client);
    const refreshToken = await this.service.generateRefreshToken(client);

    this.service.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @Patch('update/:id')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Обновить данные работника' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.STAFF_UPDATE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<ReadStaffDto> {
    return await this.service.update(id, dto);
  }

  @Delete('delete/:id')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Удалить работника' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.STAFF_DELETE)
  async softDelete(@Param('id') id: string) {
    return await this.service.softDelete(id);
  }

  @Get('refresh')
  @ApiCookieAuth(COOKIE_NAMES.STAFF_REFRESH_TOKEN)
  @ApiOperation({ summary: 'Рефреш токен' })
  @ApiOkResponse({ type: TokenStaffResponseDto })
  async refresh(@Req() req: Request) {
    const token = req.cookies?.[COOKIE_NAMES.STAFF_REFRESH_TOKEN];
    if (!token) {
      throw new MissingTokenException('Missing refresh token');
    }

    const accessToken = await this.service.refresh(token);

    return { accessToken };
  }

  @Get('me')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Получить данные текущего пользователя' })
  @ApiOkResponse({ type: TokenStaffResponseDto })
  @UseGuards(JwtStaffAuthGuard)
  async findMe(@CurrentStaff('sub') id: string) {
    return this.service.findOne(id);
  }

  @Patch('me/password')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Изменить пароль' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Пароль успешно изменен' })
  @UseGuards(JwtStaffAuthGuard)
  async changePassword(
    @CurrentStaff('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.service.changePassword(userId, dto);
  }

  @Get('find-by-login/:login')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Найти работника по логину' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.STAFF_READ)
  async findByLogin(@Param() dto: FindByLoginDto): Promise<ReadStaffDto> {
    return await this.service.findOneByLogin(dto.login);
  }

  @Get('all')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Получить список всех работников' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.STAFF_READ)
  async findAll(): Promise<ReadStaffDto[]> {
    return await this.service.findAll();
  }

  @Get(':id')
  @ApiBearerAuth('staff-auth')
  @ApiOperation({ summary: 'Получить данные работника по айди' })
  @UseGuards(JwtStaffAuthGuard, AclGuard)
  @RequirePermission(Permission.STAFF_READ)
  async findOne(@Param() dto: GetStaffDto): Promise<ReadStaffDto> {
    return this.service.findOne(dto.id);
  }
}
