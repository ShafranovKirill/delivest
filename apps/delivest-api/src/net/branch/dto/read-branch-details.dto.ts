import { BranchDetailsResponce } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ReadBranchDetailsDto implements BranchDetailsResponce {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiProperty()
  @Expose()
  address: string;
}
