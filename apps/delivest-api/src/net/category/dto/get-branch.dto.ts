import { GetBranchRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetCategoryDto implements GetBranchRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;
}
