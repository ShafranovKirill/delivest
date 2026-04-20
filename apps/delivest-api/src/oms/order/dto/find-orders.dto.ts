import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsDate,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../../../../generated/prisma/enums.js';
import { FindOrdersRequest } from '@delivest/types';

export class FindOrdersDto implements FindOrdersRequest {
  @ApiPropertyOptional({
    example: '550e8400-e29b-4114-a432-446655440000',
    description: 'ID филиала',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    example: 'PENDING',
    description: 'Статус заказа',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatus?: OrderStatus;

  @ApiPropertyOptional({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Начало периода (ISO дата)',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({
    example: '2024-01-31T23:59:59.999Z',
    description: 'Конец периода (ISO дата)',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    example: 1,
    description: 'Номер страницы',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Количество записей на странице',
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}
