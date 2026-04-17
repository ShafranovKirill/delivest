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

import { CartService } from './cart.service.js';
import { AddToCartDto } from './dto/add-item.dto.js';
import { IdParamDto } from './dto/id-param.dto.js';
import { ReadCartDto } from './dto/read-cart.dto.js';
import { CurrentStaff } from '../../shared/decorators/current-staff.decorator.js';
import { JwtStaffAuthGuard } from '../../identify/index.js';
import { AclGuard } from '../../identify/acl/guards/acl.guard.js';
import { RequirePermission } from '../../identify/acl/decorators/require-permission.decorator.js';
import { Permission } from '../../../generated/prisma/enums.js';

@ApiTags('Admin-cart (Корзина-crm)')
@UseGuards(JwtStaffAuthGuard, AclGuard)
@ApiBearerAuth('staff-auth')
@Controller('admin/cart')
export class AdminCartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Получить корзину текущего сотрудника' })
  @RequirePermission(Permission.ORDER_CREATE)
  async getStaffCart(
    @CurrentStaff('sub') staffId: string,
  ): Promise<ReadCartDto> {
    return this.cartService.getCart({ staffId });
  }

  @Post('add')
  @ApiOperation({ summary: 'Добавить товар в корзину сотрудника' })
  @RequirePermission(Permission.ORDER_CREATE)
  async addItem(
    @CurrentStaff('sub') staffId: string,
    @Body() dto: AddToCartDto,
  ): Promise<ReadCartDto> {
    return this.cartService.addItem({ staffId }, dto.productId, dto.quantity);
  }

  @Patch('remove-one/:productId')
  @ApiOperation({ summary: 'Уменьшить количество на 1' })
  @RequirePermission(Permission.ORDER_CREATE)
  async removeOne(
    @CurrentStaff('sub') staffId: string,
    @Param() params: IdParamDto,
  ): Promise<ReadCartDto> {
    return this.cartService.removeItem({ staffId }, params.productId, false);
  }

  @Delete('item/:productId')
  @RequirePermission(Permission.ORDER_CREATE)
  @ApiOperation({ summary: 'Полностью удалить товар из корзины' })
  async removeAll(
    @CurrentStaff('sub') staffId: string,
    @Param('productId') productId: string,
  ): Promise<ReadCartDto> {
    return this.cartService.removeItem({ staffId }, productId, true);
  }

  @Delete('clear')
  @RequirePermission(Permission.ORDER_CREATE)
  @ApiOperation({ summary: 'Очистить корзину сотрудника' })
  async clearStaffCart(@CurrentStaff('sub') staffId: string) {
    await this.cartService.clearCart({ staffId });
    return { success: true, message: 'Staff cart cleared' };
  }
}
