import { RemoveFromCartRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsBoolean } from 'class-validator';

export class RemoveFromCartDto implements RemoveFromCartRequest {
  @ApiProperty({
    example: '550e8400-e29b-4114-a432-446655440000',
    description: 'ID корзины из базы данных',
  })
  @IsUUID()
  cartId: string;

  @ApiProperty({
    example: '550e8400-e29b-4114-a432-446655440000',
    description: 'ID товара из базы данных',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: null, description: 'удалить весь товар?' })
  @IsBoolean()
  deleteAll: boolean;
}
