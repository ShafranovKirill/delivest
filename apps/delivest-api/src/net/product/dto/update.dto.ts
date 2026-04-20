import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create.dto.js';
import { IsString, IsNotEmpty } from 'class-validator';
import { UpdateProductRequest } from '@delivest/types';

export class UpdateProductDto
  extends PartialType(CreateProductDto)
  implements UpdateProductRequest
{
  @ApiProperty({ example: 'asd123' })
  @IsString()
  @IsNotEmpty()
  productId: string;
}
