import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrderService } from './order.service.js';
import { ReadOrderDto } from './dto/read.dto.js';
import { ReadValidateOrderDto } from './dto/read-validate.dto.js';
import { ValidateOrderDto } from './dto/validate.dto.js';
import { AddToOrderDto } from './dto/add-item.dto.js';
import { RemoveFromOrderDto } from './dto/remove-item.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { AdminCreateOrderDto } from './dto/admin-create.dto.js';
import { CurrentStaff } from '../../shared/decorators/current-staff.decorator.js';
import { JwtStaffAuthGuard } from '../../identify/index.js';
import { AclGuard } from '../../identify/acl/guards/acl.guard.js';
import { Permission } from '../../../generated/prisma/enums.js';
import { RequirePermission } from '../../identify/acl/decorators/require-permission.decorator.js';
import { FindOrdersDto } from './dto/find-orders.dto.js';
import { type AccessStaffTokenPayload } from '@delivest/types';

@ApiTags('Admin-orders (Заказы-crm)')
@ApiHeader({
  name: 'Cookie',
  description: 'Может содержать session_id для неавторизованных пользователей',
  required: false,
})
@ApiBearerAuth('staff-auth')
@UseGuards(JwtStaffAuthGuard, AclGuard)
@Controller('orders')
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @ApiOperation({
    summary: 'Получить список заказов филиала с пагинацией и фильтрами',
  })
  @ApiResponse({
    status: 200,
    description: 'Список заказов',
    type: [ReadOrderDto],
  })
  @RequirePermission(Permission.ORDER_READ)
  async findAll(
    @Body() dto: FindOrdersDto,
    @CurrentStaff() staff: AccessStaffTokenPayload,
  ): Promise<ReadOrderDto[]> {
    return await this.orderService.findAllByBranch(
      dto.branchId!,
      dto.orderStatus,
      dto.startDate,
      dto.endDate,
      dto.page,
      dto.limit,
      staff,
    );
  }

  @Post('validate')
  @ApiOperation({
    summary: 'Валидация корзины перед созданием заказа (получение токена)',
  })
  @ApiResponse({
    status: 200,
    description: 'Данные валидации и временный токен',
    type: ReadValidateOrderDto,
  })
  @RequirePermission(Permission.ORDER_CREATE)
  async validateOrder(
    @Body() dto: ValidateOrderDto,
  ): Promise<ReadValidateOrderDto> {
    return await this.orderService.validateOrder(dto);
  }

  @Post()
  @ApiOperation({ summary: 'Создать новый заказ' })
  @ApiResponse({
    status: 201,
    description: 'Заказ успешно создан',
    type: ReadOrderDto,
  })
  @RequirePermission(Permission.ORDER_CREATE)
  async createOrder(
    @CurrentStaff() staff: AccessStaffTokenPayload,
    @Body() dto: AdminCreateOrderDto,
  ): Promise<ReadOrderDto> {
    return await this.orderService.createOrder(
      dto,
      dto.clientId,
      staff,
      dto.status,
    );
  }

  @Post('item')
  @ApiOperation({ summary: 'Добавить товар в заказ' })
  @ApiResponse({
    status: 200,
    description: 'Заказ с обновлённым товаром',
    type: ReadOrderDto,
  })
  @RequirePermission(Permission.ORDER_UPDATE)
  async addItem(
    @Body() dto: AddToOrderDto,
    @CurrentStaff() staff: AccessStaffTokenPayload,
  ): Promise<ReadOrderDto> {
    return await this.orderService.addItem(
      dto.orderId,
      dto.productId,
      dto.quantity,
      staff,
    );
  }

  @Patch('item')
  @ApiOperation({
    summary: 'Уменьшить количество товара или удалить товар из заказа',
  })
  @ApiResponse({
    status: 200,
    description: 'Заказ с обновлёнными позициями',
    type: ReadOrderDto,
  })
  @RequirePermission(Permission.ORDER_UPDATE)
  async removeItem(@Body() dto: RemoveFromOrderDto): Promise<ReadOrderDto> {
    return await this.orderService.removeItem(
      dto.orderId,
      dto.productId,
      dto.deleteAll,
    );
  }

  @Patch('status')
  @ApiOperation({ summary: 'Обновить статус заказа (Admin/Staff)' })
  @ApiResponse({
    status: 200,
    description: 'Статус обновлен',
    type: ReadOrderDto,
  })
  @RequirePermission(Permission.ORDER_UPDATE)
  async updateStatus(
    @Body() dto: UpdateOrderStatusDto,
    @CurrentStaff() staff: AccessStaffTokenPayload,
  ): Promise<ReadOrderDto> {
    return await this.orderService.updateStatus(dto.orderId, dto.status, staff);
  }
}
