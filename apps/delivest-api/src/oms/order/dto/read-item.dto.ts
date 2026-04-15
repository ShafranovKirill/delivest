import { OrderItemResponse } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ReadOrderItemDto implements OrderItemResponse {
  @ApiProperty({ example: 'prod-123' })
  @Expose()
  productId!: string;

  @ApiProperty({ example: 'Пицца Маргарита' })
  @Expose()
  title!: string;

  @ApiProperty({ example: 850 })
  @Expose()
  price!: number;

  @ApiProperty({ example: 2 })
  @Expose()
  quantity!: number;
}
