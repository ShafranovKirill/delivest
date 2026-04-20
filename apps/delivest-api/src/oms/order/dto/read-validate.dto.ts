import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ReadCartDto } from '../../cart/dto/read-cart.dto.js';

export class ReadValidateOrderDto extends ReadCartDto {
  @ApiProperty({
    description: 'JWT токен для подтверждения состава и цены заказа',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @Expose()
  validationToken!: string;
}
