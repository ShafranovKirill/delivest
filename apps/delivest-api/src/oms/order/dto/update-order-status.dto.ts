import { UpdateOrderStatusRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { OrderStatus } from '../../../../generated/prisma/enums.js';

export class UpdateOrderStatusDto implements UpdateOrderStatusRequest {
  @ApiProperty({
    description: 'ID заказа',
    example: '6e2a38a2-cfc3-4246-84bc-7f8902f07fb2',
  })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    description: 'Новый статус заказа',
    enum: OrderStatus,
    example: OrderStatus.PROCESSING,
  })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;
}
