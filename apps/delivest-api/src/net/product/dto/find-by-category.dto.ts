import { FindProductsByCategoryRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetProductsByCategoryDto implements FindProductsByCategoryRequest {
  @ApiProperty({ description: 'Id категории' })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;
}
