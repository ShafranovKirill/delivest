import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class IdParamDto {
  @ApiProperty({
    example: 'uuid-v4-string',
    description: 'ID',
  })
  @IsUUID()
  productId: string;
}
