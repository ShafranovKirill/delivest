import { StaffResponse } from '@delivest/types';
import { Expose } from 'class-transformer';

export class ReadStaffDto implements StaffResponse {
  @Expose()
  id!: string;

  @Expose()
  login!: string;

  @Expose()
  roleId: string;

  @Expose()
  name: string;

  @Expose()
  branchIds: string[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
