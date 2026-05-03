import { PhotoKey } from '@delivest/common';
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

  @ApiProperty({ required: false })
  @Expose()
  order: number;

  @ApiProperty({ required: false })
  @Expose()
  weight?: number | undefined;

  @ApiProperty({ required: false })
  @Expose()
  quantity?: number | undefined;

  @ApiProperty({
    description:
      'объект фото продукта (ключ: photo type, значение: ключ для s3)',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @Expose()
  photos!: Record<PhotoKey, string>;

  @Expose()
  createdAt: Date | undefined;

  @Expose()
  updatedAt: Date | undefined;

  @Expose()
  deletedAt: Date | undefined;
}
