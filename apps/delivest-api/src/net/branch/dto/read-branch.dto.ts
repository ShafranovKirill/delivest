import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ReadBranchDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  alias!: string;

  @ApiProperty()
  @Expose()
  name!: string;
}
