import { PASSWORD_REGEX } from '@delivest/common';
import { LoginRequest } from '@delivest/types';
import { IsString, Matches } from 'class-validator';

export class LoginDto implements LoginRequest {
  @IsString()
  login!: string;

  @IsString()
  @Matches(PASSWORD_REGEX)
  password!: string;
}
