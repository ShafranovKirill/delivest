import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { CreateOrderRequest } from '@delivest/types';
import {
  DeliveryType,
  OrderStatus,
} from '../../../../generated/prisma/enums.js';

export class CreateOrderDto implements CreateOrderRequest {
  @ApiProperty({
    example: '550e8400-e29b-4114-a432-446655440000',
    description: 'ID корзины пользователя',
  })
  @IsUUID()
  @IsNotEmpty()
  cartId: string;

  @ApiProperty({
    example: '550e8400-e29b-4114-a432-446655440000',
    description: 'ID филиала',
  })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.PENDING,
    description: 'Статус заказа (для сотрудников)',
  })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @ApiProperty({
    example: '+79991234567',
    description: 'Номер телефона для связи',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    enum: DeliveryType,
    example: DeliveryType.DELIVERY,
    description: 'Способ доставки',
  })
  @IsEnum(DeliveryType)
  @IsOptional()
  deliveryType?: DeliveryType;

  @ApiPropertyOptional({
    example: 'Домофон 45#',
    description: 'Комментарий к заказу',
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({
    example: 'ул. Пушкина, д. Колотушкина',
    description: 'Адрес доставки',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: 'ID клиента (если заказ создает сотрудник)',
  })
  @IsUUID()
  @IsOptional()
  clientId?: string;

  @ApiPropertyOptional({ description: 'ID сотрудника, принявшего заказ' })
  @IsUUID()
  @IsOptional()
  staffId?: string;

  @ApiPropertyOptional({ description: 'Токен валидации цен (для клиента)' })
  @IsString()
  @IsOptional()
  validationToken?: string;
}
