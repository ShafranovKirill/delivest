import { GetProductsByCategoryRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetProductsByCategoryDto implements GetProductsByCategoryRequest {
  @ApiProperty({ description: 'Id категории' })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;
}
