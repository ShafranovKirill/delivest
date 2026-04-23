import { StaffResponse } from '@delivest/types';
import { Expose } from 'class-transformer';
import { Permission } from '../../../../generated/prisma/enums.js';

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
  permissions: Permission[];

  @Expose()
  branchIds: string[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
