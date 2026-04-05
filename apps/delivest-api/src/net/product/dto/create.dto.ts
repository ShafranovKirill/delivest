import { CreateProductRequest } from '@delivest/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProductDto implements CreateProductRequest {
  @ApiProperty({ example: 'Пицца Маргарита' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  order!: number;

  @ApiProperty({ example: 550 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional({ example: '7d2e0b12-9c3a-4f1e-8d5c-1a2b3c4d5e6f' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'Очень вкусная пицца с томатами' })
  @IsString()
  @IsOptional()
  description?: string;
}
