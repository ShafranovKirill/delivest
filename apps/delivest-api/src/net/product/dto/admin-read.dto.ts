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

  @ApiProperty({
    description:
      'Dictionary of product photos (key: photo type, value: file ID or URL)',
    example: { product_card: 'uuid-string', product_preview: 'uuid-string' },
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @Expose()
  photos!: Record<string, string>;

  @Expose()
  createdAt: Date | undefined;

  @Expose()
  updatedAt: Date | undefined;

  @Expose()
  deletedAt: Date | undefined;
}
