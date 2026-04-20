import { CartResponse } from '@delivest/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ReadCartItemDto } from './read-item.dto.js';

export class ReadCartDto implements CartResponse {
  @ApiProperty({ example: 'uuid-v4-string' })
  @Expose()
  id!: string;

  @ApiPropertyOptional({
    example: 'session-123',
    description: 'ID анонимной сессии',
  })
  @Expose()
  sessionId?: string;

  @ApiPropertyOptional({
    example: 'client-456',
    description: 'ID зарегистрированного клиента',
  })
  @Expose()
  clientId?: string;

  @ApiPropertyOptional({
    example: 'staff-789',
    description: 'ID сотрудника, если корзина его',
  })
  @Expose()
  staffId?: string;

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
