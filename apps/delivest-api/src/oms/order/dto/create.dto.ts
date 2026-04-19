import { CreateOrderRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrderDto implements CreateOrderRequest {
  @ApiProperty({ description: 'Токен, полученный из validateOrder' })
  @IsString()
  @IsNotEmpty()
  validationToken: string;
}
