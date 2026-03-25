import { GetCategoryByBranchRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetCategoryByBranchDto implements GetCategoryByBranchRequest {
  @ApiProperty({ description: 'Id филиала' })
  @IsString()
  @IsNotEmpty()
  branchId!: string;
}
