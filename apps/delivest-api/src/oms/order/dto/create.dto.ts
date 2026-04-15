import { CreateOrderRequest } from '@delivest/types';
import { ValidateOrderDto } from './validate.dto.js';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrderDto
  extends ValidateOrderDto
  implements CreateOrderRequest
{
  @ApiProperty({ description: 'Токен, полученный из validateOrder' })
  @IsString()
  @IsNotEmpty()
  validationToken: string;
}
