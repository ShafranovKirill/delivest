import { FindProductRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetProductDto implements FindProductRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;
}
