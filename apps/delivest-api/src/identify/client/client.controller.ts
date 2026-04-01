/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ClientService } from './client.service.js';
import { LoginClientDto } from './dto/login.dto.js';
import type { Request, Response } from 'express';
import { TokenClientResponseDto } from './dto/token.dto.js';
import { MissingTokenException } from '../../shared/exception/domain_exception/domain-exception.js';
import { JwtClientAuthGuard } from './guards/jwt-client.guard.js';
import { CurrentClient } from '../../shared/decorators/current-client.decorator.js';
import { CreateClientDto } from './dto/create.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SendCodeDto } from './dto/send-code.dto.js';

@ApiTags('Client (Клиенты)')
@Controller('client')
export class ClientController {
  private readonly logger = new Logger(ClientService.name);

  constructor(private readonly service: ClientService) {}

  @Post('login')
  @ApiOperation({ summary: 'Вход' })
  @ApiOkResponse({ type: TokenClientResponseDto })
  async login(
    @Body() dto: LoginClientDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenClientResponseDto> {
    const account = await this.service.validateCredentials(dto);
    const accessToken = await this.service.generateAccessToken(account);
    const refreshToken = await this.service.generateRefreshToken(account);

    this.service.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @Post('login-by-code')
  @ApiOperation({ summary: 'Вход по коду' })
  @ApiOkResponse({ type: TokenClientResponseDto })
  async loginByCode(
    @Body() dto: LoginClientDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenClientResponseDto> {
    const account = await this.service.validateCredentials(dto);
    const accessToken = await this.service.generateAccessToken(account);
    const refreshToken = await this.service.generateRefreshToken(account);

    this.service.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @Post('send-code')
  @ApiOperation({ summary: 'Отправить код' })
  @ApiOkResponse({ type: TokenClientResponseDto })
  async sendCode(@Body() dto: SendCodeDto) {
    return this.service.sendCode(dto.phone);
  }

  @Post('register')
  @ApiOperation({ summary: 'Регистрация' })
  @ApiOkResponse({ type: TokenClientResponseDto })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: CreateClientDto,
  ) {
    const client = await this.service.create(dto);
    const accessToken = await this.service.generateAccessToken(client);
    const refreshToken = await this.service.generateRefreshToken(client);

    this.service.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @Get('refresh')
  @ApiCookieAuth('client_refresh_token')
  @ApiOperation({ summary: 'Рефреш токен' })
  @ApiOkResponse({ type: TokenClientResponseDto })
  async refresh(@Req() req: Request) {
    const token = req.cookies?.['client_refresh_token'];

    if (!token) {
      throw new MissingTokenException('Missing refresh token');
    }

    const accessToken = await this.service.refresh(token);

    return { accessToken };
  }

  @Get('me')
  @ApiBearerAuth('client-auth')
  @ApiOperation({ summary: 'Получить данные текущего пользователя' })
  @ApiOkResponse({ type: TokenClientResponseDto })
  @UseGuards(JwtClientAuthGuard)
  async findMe(@CurrentClient('sub') id: string) {
    return this.service.findOne(id);
  }

  @Patch('me/password')
  @ApiBearerAuth('client-auth')
  @ApiOperation({ summary: 'Изменить пароль' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Пароль успешно изменен' })
  @UseGuards(JwtClientAuthGuard)
  async changePassword(
    @CurrentClient('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.service.changePassword(userId, dto);
  }
}
