import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AdminReadCategoryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Закуски' })
  @Expose()
  name!: string;

  @ApiProperty({ example: 1 })
  @Expose()
  order!: number;

  @ApiProperty({ example: 'branch-uuid-999' })
  @Expose()
  branchId!: string;

  @ApiProperty({ example: '2026-04-05T10:00:00.000Z' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ example: '2026-04-05T10:00:00.000Z' })
  @Expose()
  updatedAt!: Date;

  @ApiProperty({ example: null, required: false })
  @Expose()
  deletedAt?: Date | null;
}
