import { OrderResponse } from '@delivest/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  DeliveryType,
  OrderStatus,
} from '../../../../generated/prisma/enums.js';
import { ReadOrderItemDto } from './read-item.dto.js';

export class ReadOrderDto implements OrderResponse {
  @ApiProperty({ example: 'order-uuid-v4' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 1024, description: 'Порядковый номер заказа' })
  @Expose()
  orderNumber!: number;

  @ApiPropertyOptional({ example: 'client-456' })
  @Expose()
  clientId?: string;

  @ApiPropertyOptional({ example: 'staff-789' })
  @Expose()
  staffId?: string;

  @ApiProperty({ enum: OrderStatus, example: 'PENDING' })
  @Expose()
  status!: OrderStatus;

  @ApiProperty({ enum: DeliveryType, example: 'DELIVERY' })
  @Expose()
  deliveryType!: DeliveryType;

  @ApiProperty({ example: 1700 })
  @Expose()
  totalPrice!: number;

  @ApiPropertyOptional({ example: 'ул. Пушкина, д. Колотушкина' })
  @Expose()
  address?: string;

  @ApiPropertyOptional({ example: 'Домофон не работает, позвоните' })
  @Expose()
  comment?: string;

  @ApiProperty({ example: '+79991234567' })
  @Expose()
  phone!: string;

  @ApiProperty({ type: [ReadOrderItemDto] })
  @Expose()
  @Type(() => ReadOrderItemDto)
  items!: ReadOrderItemDto[];

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
