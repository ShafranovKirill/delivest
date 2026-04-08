import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger/dist/decorators/index.js';
import { COOKIE_NAMES } from '@delivest/common';
import { CartService } from './cart.service.js';
import { AddToCartDto } from './dto/add-item.dto.js';
import type { Request } from 'express';
import { IdParamDto } from './dto/id-param.dto.js';
import { ReadCartDto } from './dto/read-cart.dto.js';

@ApiTags('Cart (Корзина)')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Получить текущую корзину' })
  @ApiResponse({
    status: 200,
    description: 'Данные корзины',
    type: ReadCartDto,
  })
  @ApiHeader({
    name: 'Cookie',
    description: 'Должен содержать session_id',
    required: true,
  })
  async getCart(@Req() req: Request): Promise<ReadCartDto> {
    const sessionId = this.getSessionId(req);
    return await this.cartService.getCart(sessionId);
  }

  @Post('add')
  @ApiOperation({ summary: 'Добавить товар в корзину' })
  @ApiResponse({
    status: 201,
    description: 'Товар успешно добавлен',
    type: ReadCartDto,
  })
  @ApiHeader({
    name: 'Cookie',
    description: 'Должен содержать session_id',
    required: true,
  })
  async addItem(@Req() req: Request, @Body() dto: AddToCartDto) {
    const sessionId = this.getSessionId(req);
    return await this.cartService.addItem(
      sessionId,
      dto.productId,
      dto.quantity,
    );
  }

  @Patch('remove-one/:productId')
  @ApiOperation({ summary: 'Уменьшить количество товара на 1' })
  @ApiResponse({
    status: 200,
    description: 'Товар успешно удален',
    type: ReadCartDto,
  })
  @ApiHeader({
    name: 'Cookie',
    description: 'Должен содержать session_id',
    required: true,
  })
  async removeOne(
    @Req() req: Request,
    @Param() params: IdParamDto,
  ): Promise<ReadCartDto> {
    const sessionId = this.getSessionId(req);
    return await this.cartService.removeItem(
      sessionId,
      params.productId,
      false,
    );
  }

  @Delete('item/:productId')
  @ApiOperation({ summary: 'Полностью удалить позицию из корзины' })
  @ApiResponse({
    status: 200,
    description: 'Товар успешно удален',
    type: ReadCartDto,
  })
  @ApiHeader({
    name: 'Cookie',
    description: 'Должен содержать session_id',
    required: true,
  })
  async removeAll(
    @Req() req: Request,
    @Param('productId') productId: string,
  ): Promise<ReadCartDto> {
    const sessionId = this.getSessionId(req);
    return await this.cartService.removeItem(sessionId, productId, true);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Принудительная синхронизация и проверка цен' })
  @ApiHeader({
    name: 'Cookie',
    description: 'Должен содержать session_id',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Корзина успешно синхронизирована',
    type: ReadCartDto,
  })
  async validate(@Req() req: Request): Promise<ReadCartDto> {
    const sessionId = this.getSessionId(req);
    return await this.cartService.validateCart(sessionId);
  }

  @Delete('clear')
  @ApiOperation({ summary: 'Очистить всю корзину' })
  @ApiHeader({
    name: 'Cookie',
    description: 'Должен содержать session_id',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Корзина успешно очищена',
  })
  async clear(@Req() req: Request) {
    const sessionId = this.getSessionId(req);
    await this.cartService.clearCart(sessionId);
    return { success: true, message: 'Cart cleared' };
  }

  private getSessionId(req: Request): string {
    const sessionId = req.cookies[COOKIE_NAMES.SESSION_ID] as string;

    if (!sessionId) {
      throw new BadRequestException(
        'Session not initialized. Please refresh page.',
      );
    }

    return sessionId;
  }
}
