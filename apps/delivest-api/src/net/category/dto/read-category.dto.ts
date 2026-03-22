import { CategoryResponce } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ReadCategoryDto implements CategoryResponce {
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
