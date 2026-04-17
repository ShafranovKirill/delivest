import { AdminCreateOrderRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { OrderStatus } from '../../../../generated/prisma/enums.js';

export class AdminCreateOrderDto implements AdminCreateOrderRequest {
  @ApiProperty({ description: 'Токен, полученный из validateOrder' })
  @IsString()
  @IsNotEmpty()
  validationToken: string;

  @ApiProperty({ description: 'ID клиента, для которого создается заказ' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ description: 'Статус заказа' })
  @IsEnum({ enum: ['PENDING'] })
  @IsNotEmpty()
  status: OrderStatus;
}
