/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ClientService } from './client.service.js';
import { LoginClientDto } from './dto/login.dto.js';
import type { Request, Response } from 'express';
import { TokenClientResponseDto } from './dto/token.dto.js';
import { MissingTokenException } from '../../shared/exceptions/domain_exception/domain-exception.js';
import { JwtClientAuthGuard } from './guards/jwt-client.guard.js';
import { CurrentClient } from '../../shared/decorators/current-client.decorator.js';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SendCodeDto } from './dto/send-code.dto.js';
import { SendCodeType } from '../../../generated/prisma/client.js';
import { COOKIE_NAMES } from '@delivest/common';
import { SessionId } from '../../shared/decorators/session-id.decorator.js';

@ApiTags('Client (Клиенты)')
@Controller('client')
export class ClientController {
  private readonly logger = new Logger(ClientService.name);

  constructor(private readonly service: ClientService) {}

  @Post('login-by-code')
  @ApiOperation({ summary: 'Вход по коду' })
  @ApiHeader({
    name: 'Cookie',
    description:
      'Может содержать session_id для неавторизованных пользователей',
    required: false,
  })
  @ApiOkResponse({ type: TokenClientResponseDto })
  async loginByCode(
    @Body() dto: LoginClientDto,
    @Res({ passthrough: true }) res: Response,
    @SessionId() sessionId: string,
  ): Promise<TokenClientResponseDto> {
    const account = await this.service.loginByCode(
      dto.phone,
      dto.code,
      sessionId,
    );
    const accessToken = await this.service.generateAccessToken(account);
    const refreshToken = await this.service.generateRefreshToken(account);

    this.service.setRefreshCookie(res, refreshToken);

    return { accessToken };
  }

  @Post('send-code-zvonok')
  @ApiOperation({ summary: 'Отправить код через Zvonok' })
  @ApiOkResponse({ type: TokenClientResponseDto })
  async sendCode(@Body() dto: SendCodeDto) {
    return this.service.sendCode(dto.phone, SendCodeType.ZVONOK);
  }

  @Get('refresh')
  @ApiCookieAuth(COOKIE_NAMES.CLIENT_REFRESH_TOKEN)
  @ApiOperation({ summary: 'Рефреш токен' })
  @ApiOkResponse({ type: TokenClientResponseDto })
  async refresh(@Req() req: Request) {
    const token = req.cookies?.[COOKIE_NAMES.CLIENT_REFRESH_TOKEN];
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
}
