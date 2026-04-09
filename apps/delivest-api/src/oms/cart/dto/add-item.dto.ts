import { AddToCartRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min } from 'class-validator';

export class AddToCartDto implements AddToCartRequest {
  @ApiProperty({
    example: '550e8400-e29b-4114-a432-446655440000',
    description: 'ID товара из базы данных',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 1, description: 'Количество товара' })
  @IsInt()
  @Min(1)
  quantity: number;
}
