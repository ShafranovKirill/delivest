import { TokenClientResponse } from '@delivest/types';

export class TokenClientResponseDto implements TokenClientResponse {
  accessToken!: string;
}
