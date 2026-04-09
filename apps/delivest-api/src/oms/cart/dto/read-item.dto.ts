import { CartItemResponse } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ReadCartItemDto implements CartItemResponse {
  @ApiProperty({ description: 'ID позиции в корзине' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  productId!: string;

  @ApiProperty()
  @Expose()
  quantity!: number;

  @ApiProperty()
  @Expose()
  price!: number;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  totalPrice: number;
}
