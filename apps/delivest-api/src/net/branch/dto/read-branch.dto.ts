import { Expose } from 'class-transformer';

export class ReadBranchDto {
  @Expose()
  id!: string;

  @Expose()
  alias!: string;

  @Expose()
  name!: string;
}
