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

import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger/dist/decorators/index.js';
import { CartService } from './cart.service.js';
import { AddToCartDto } from './dto/add-item.dto.js';
import { ReadCartDto } from './dto/read-cart.dto.js';
import { CurrentCartOwner } from '../../shared/decorators/current-cart-owner.decorator.js'; // Путь к новому декоратору
import type { CartOwner } from './interfaces/cart-owner.interface.js';
import { OptionalJwtClientAuthGuard } from '../../identify/client/guards/jwt-client-optional.guard.js';
import { RemoveFromCartDto } from './dto/remove-item.dto.js';

@ApiTags('Cart (Корзина)')
@UseGuards(OptionalJwtClientAuthGuard)
@ApiBearerAuth('client-auth')
@ApiHeader({
  name: 'Cookie',
  description: 'Может содержать session_id для неавторизованных пользователей',
  required: false,
})
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
  async getCart(@CurrentCartOwner() owner: CartOwner): Promise<ReadCartDto> {
    return await this.cartService.getCart(owner);
  }

  @Post('add')
  @ApiOperation({ summary: 'Добавить товар в корзину' })
  @ApiResponse({
    status: 201,
    description: 'Товар успешно добавлен',
    type: ReadCartDto,
  })
  async addItem(
    @CurrentCartOwner() owner: CartOwner,
    @Body() dto: AddToCartDto,
  ): Promise<ReadCartDto> {
    return await this.cartService.addItem(owner, dto.productId, dto.quantity);
  }

  @Patch('remove')
  @ApiOperation({ summary: 'Удалить товар из корзины (один или весь)' })
  @ApiResponse({
    status: 200,
    description: 'Товар успешно удален',
    type: ReadCartDto,
  })
  async removeOne(
    @CurrentCartOwner() owner: CartOwner,
    @Body() dto: RemoveFromCartDto,
  ): Promise<ReadCartDto> {
    return await this.cartService.removeItem(
      owner,
      dto.productId,
      dto.deleteAll,
    );
  }

  @Delete('item/:productId')
  @ApiOperation({ summary: 'Полностью удалить позицию из корзины' })
  @ApiResponse({
    status: 200,
    description: 'Товар успешно удален',
    type: ReadCartDto,
  })
  async removeAll(
    @CurrentCartOwner() owner: CartOwner,
    @Param('productId') productId: string,
  ): Promise<ReadCartDto> {
    return await this.cartService.removeItem(owner, productId, true);
  }

  @Delete('clear')
  @ApiOperation({ summary: 'Очистить всю корзину' })
  @ApiResponse({
    status: 200,
    description: 'Корзина успешно очищена',
  })
  async clear(@CurrentCartOwner() owner: CartOwner) {
    await this.cartService.clearCart(owner);
    return { success: true, message: 'Cart cleared' };
  }
}
