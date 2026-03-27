import { GetClientRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetClientDto implements GetClientRequest {
  @ApiProperty({
    description: 'Id клиента',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  id!: string;
}
