import { AdminCreateOrderRequest } from '@delivest/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../../../../generated/prisma/enums.js';

export class AdminCreateOrderDto implements AdminCreateOrderRequest {
  @ApiProperty({ description: 'Токен, полученный из validateOrder' })
  @IsString()
  @IsNotEmpty()
  validationToken: string;

  @ApiPropertyOptional({
    description: 'ID клиента, для которого создается заказ',
  })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Статус заказа' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
