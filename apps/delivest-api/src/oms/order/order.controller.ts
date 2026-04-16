import {
  Body,
  Controller,
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
} from '@nestjs/swagger';
import { OrderService } from './order.service.js';
import { ReadOrderDto } from './dto/read.dto.js';
import { ReadValidateOrderDto } from './dto/read-validate.dto.js';
import { OrderStatus } from '../../../generated/prisma/client.js';
import { CurrentClient } from '../../shared/decorators/current-client.decorator.js'; // Пример декоратора для получения ID клиента
import { OptionalJwtClientAuthGuard } from '../../identify/client/guards/jwt-client-optional.guard.js';
import { CreateOrderDto } from './dto/create.dto.js';
import { ValidateOrderDto } from './dto/validate.dto.js';

@ApiTags('Orders (Заказы)')
@UseGuards(OptionalJwtClientAuthGuard)
@ApiHeader({
  name: 'Cookie',
  description: 'Может содержать session_id для неавторизованных пользователей',
  required: false,
})
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('validate')
  @ApiBearerAuth('client-auth')
  @ApiOperation({
    summary: 'Валидация корзины перед созданием заказа (получение токена)',
  })
  @ApiResponse({
    status: 200,
    description: 'Данные валидации и временный токен',
    type: ReadValidateOrderDto,
  })
  async validateOrder(
    @Body() dto: ValidateOrderDto,
  ): Promise<ReadValidateOrderDto> {
    return await this.orderService.validateOrder(dto);
  }

  @Post()
  @ApiBearerAuth('client-auth')
  @ApiOperation({ summary: 'Создать новый заказ' })
  @ApiResponse({
    status: 201,
    description: 'Заказ успешно создан',
    type: ReadOrderDto,
  })
  async createOrder(
    @CurrentClient('sub') clientId: string,
    @Body() dto: CreateOrderDto,
  ): Promise<ReadOrderDto> {
    return await this.orderService.createOrder({
      ...dto,
      clientId,
      status: OrderStatus.PENDING,
    });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Обновить статус заказа (Admin/Staff)' })
  @ApiResponse({
    status: 200,
    description: 'Статус обновлен',
    type: ReadOrderDto,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
  ): Promise<ReadOrderDto> {
    return await this.orderService.updateStatus(id, status);
  }
}
