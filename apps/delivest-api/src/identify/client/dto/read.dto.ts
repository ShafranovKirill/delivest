import { ClientResponse } from '@delivest/types';
import { Expose } from 'class-transformer';

export class ReadClientDto implements ClientResponse {
  @Expose()
  id!: string;

  @Expose()
  phone!: string;
}
