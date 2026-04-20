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
import { ReadCartDto } from './dto/read-cart.dto.js';
import { CurrentStaff } from '../../shared/decorators/current-staff.decorator.js';
import { JwtStaffAuthGuard } from '../../identify/index.js';
import { AclGuard } from '../../identify/acl/guards/acl.guard.js';
import { RequirePermission } from '../../identify/acl/decorators/require-permission.decorator.js';
import { Permission } from '../../../generated/prisma/enums.js';
import { RemoveFromCartDto } from './dto/remove-item.dto.js';

@ApiTags('Admin-cart (Корзина-crm)')
@UseGuards(JwtStaffAuthGuard, AclGuard)
@ApiBearerAuth('staff-auth')
@Controller('admin/cart')
export class AdminCartController {
  constructor(private readonly cartService: CartService) {}

  @Get('/:branchId')
  @ApiOperation({ summary: 'Получить корзину текущего сотрудника' })
  @RequirePermission(Permission.ORDER_CREATE)
  async getStaffCart(
    @CurrentStaff('sub') staffId: string,
    @Param('branchId') branchId: string,
  ): Promise<ReadCartDto> {
    return this.cartService.getCart({ staffId }, branchId);
  }

  @Post('add')
  @ApiOperation({ summary: 'Добавить товар в корзину сотрудника' })
  @RequirePermission(Permission.ORDER_CREATE)
  async addItem(
    @CurrentStaff('sub') staffId: string,
    @Body() dto: AddToCartDto,
  ): Promise<ReadCartDto> {
    return this.cartService.addItem(dto.cartId, dto.productId, dto.quantity);
  }

  @Patch('remove')
  @ApiOperation({
    summary: 'Уменьшить количество на 1 либо удалить весь товар',
  })
  @RequirePermission(Permission.ORDER_CREATE)
  async removeOne(@Body() dto: RemoveFromCartDto): Promise<ReadCartDto> {
    return this.cartService.removeItem(
      dto.cartId,
      dto.productId,
      dto.deleteAll,
    );
  }

  @Delete('clear/:id')
  @RequirePermission(Permission.ORDER_CREATE)
  @ApiOperation({ summary: 'Очистить корзину сотрудника' })
  async clearStaffCart(@Param('id') id: string) {
    await this.cartService.clearCart(id);
    return { success: true, message: 'Staff cart cleared' };
  }
}
