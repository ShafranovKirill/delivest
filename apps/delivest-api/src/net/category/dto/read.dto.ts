import { CategoryResponse } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ReadCategoryDto implements CategoryResponse {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  order!: number;

  @ApiProperty()
  @Expose()
  branchId!: string;
}
