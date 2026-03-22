import { Expose } from 'class-transformer';

export class ReadBranchDetailsDto {
  @Expose()
  id!: string;

  @Expose()
  description!: string;

  @Expose()
  address!: string;
}
