import { FindProductsByBranchRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetProductsByBranchDto implements FindProductsByBranchRequest {
  @ApiProperty({ description: 'Id филиала' })
  @IsString()
  @IsNotEmpty()
  branchId!: string;
}
