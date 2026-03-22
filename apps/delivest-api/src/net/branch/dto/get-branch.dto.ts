import { GetBranchRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetBranchDto implements GetBranchRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;
}
