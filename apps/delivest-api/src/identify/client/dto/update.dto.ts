import { UpdateClientRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateClientDto implements UpdateClientRequest {
  @ApiProperty({
    description: 'Имя клиента',
    example: 'Иван Иванов',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;
}
