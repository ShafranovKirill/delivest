import { ProductResponse } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class ReadProductDto implements ProductResponse {
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

  @ApiProperty({ type: Number })
  @Expose()
  @Transform(({ value }: { value: unknown }) => (value ? Number(value) : 0))
  price: number;

  @ApiProperty()
  @Expose()
  categoryId?: string | undefined;

  @ApiProperty({ required: false })
  @Expose()
  description?: string | undefined;
}
