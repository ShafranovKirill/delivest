import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrderService } from './order.service.js';
import { ReadOrderDto } from './dto/read.dto.js';
import { ReadValidateOrderDto } from './dto/read-validate.dto.js';
import { CurrentClient } from '../../shared/decorators/current-client.decorator.js'; // Пример декоратора для получения ID клиента
import { OptionalJwtClientAuthGuard } from '../../identify/client/guards/jwt-client-optional.guard.js';
import { CreateOrderDto } from './dto/create.dto.js';
import { ValidateOrderDto } from './dto/validate.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';

@ApiTags('Orders (Заказы)')
@UseGuards(OptionalJwtClientAuthGuard)
@ApiBearerAuth('client-auth')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('validate')
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
  @ApiOperation({ summary: 'Создать новый заказ' })
  @ApiResponse({
    status: 201,
    description: 'Заказ успешно создан',
    type: ReadOrderDto,
  })
  async createOrder(
    @CurrentClient('sub') authClientId: string,
    @Body() dto: CreateOrderDto,
  ): Promise<ReadOrderDto> {
    return await this.orderService.createOrder(
      dto,
      authClientId,
      undefined,
      'PENDING',
    );
  }

  @Patch('status')
  @ApiOperation({ summary: 'Обновить статус заказа (Admin/Staff)' })
  @ApiResponse({
    status: 200,
    description: 'Статус обновлен',
    type: ReadOrderDto,
  })
  async updateStatus(@Body() dto: UpdateOrderStatusDto): Promise<ReadOrderDto> {
    return await this.orderService.updateStatus(dto.orderId, dto.status);
  }
}
