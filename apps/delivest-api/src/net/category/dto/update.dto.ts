import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create.dto.js';
import { IsNotEmpty, IsString } from 'class-validator';
import { UpdateCategoryRequest } from '@delivest/types';

export class UpdateCategoryDto
  extends PartialType(CreateCategoryDto)
  implements UpdateCategoryRequest
{
  @ApiProperty({ example: 'cat-123' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;
}
