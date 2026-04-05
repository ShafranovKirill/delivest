import { ProductResponse } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AdminReadProductDto implements ProductResponse {
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
  branchId: string;

  @ApiProperty()
  @Expose()
  price: number;

  @ApiProperty()
  @Expose()
  categoryId?: string | undefined;

  @ApiProperty({ required: false })
  @Expose()
  description?: string | undefined;

  @Expose()
  createdAt: Date | undefined;

  @Expose()
  updatedAt: Date | undefined;

  @Expose()
  deletedAt: Date | undefined;
}
