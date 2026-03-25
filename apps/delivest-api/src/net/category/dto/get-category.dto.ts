import { GetCategoryRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetCategoryDto implements GetCategoryRequest {
  @ApiProperty({ description: 'Id филиала' })
  @IsString()
  @IsNotEmpty()
  id!: string;
}
