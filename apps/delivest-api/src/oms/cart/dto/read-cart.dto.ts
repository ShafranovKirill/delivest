import { CartResponse } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ReadCartItemDto } from './read-item.dto.js';

export class ReadCartDto implements CartResponse {
  @ApiProperty({ example: 'uuid-v4-string' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'session-id-123' })
  @Expose()
  sessionId!: string;

  @ApiProperty({ type: [ReadCartItemDto] })
  @Expose()
  @Type(() => ReadCartItemDto)
  items!: ReadCartItemDto[];

  @ApiProperty({ example: 1500 })
  @Expose()
  totalPrice!: number;

  @ApiProperty({ example: 3 })
  @Expose()
  totalItems!: number;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
