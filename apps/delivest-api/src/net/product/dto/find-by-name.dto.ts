import { FindProductsByNameRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FindProductsByNameDto implements FindProductsByNameRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;
}
