import { GetProductRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetProductDto implements GetProductRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;
}
