import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ReadBranchDetailsDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  description!: string;

  @ApiProperty()
  @Expose()
  address!: string;
}
