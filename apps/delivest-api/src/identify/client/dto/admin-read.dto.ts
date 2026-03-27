import { ClientResponse } from '@delivest/types';
import { Expose } from 'class-transformer';

export class AdminReadClientDto implements ClientResponse {
  @Expose()
  id!: string;

  @Expose()
  phone!: string;

  @Expose()
  name: string;

  @Expose()
  createdAt: Date | undefined;

  @Expose()
  updatedAt: Date | undefined;

  @Expose()
  deletedAt: Date | undefined;
}
