import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create.dto.js';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { UpdateProductRequest } from '@delivest/types';

export class UpdateProductDto
  extends PartialType(CreateProductDto)
  implements UpdateProductRequest
{
  @ApiProperty({ example: 'asd123' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @IsOptional()
  order?: number | undefined;
}
