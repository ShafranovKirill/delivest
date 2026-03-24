import { PASSWORD_REGEX } from '@delivest/common';
import { CreateAccountRequest } from '@delivest/types';
import { IsString, IsUUID, Matches, MinLength } from 'class-validator';

export class CreateAccountDto implements CreateAccountRequest {
  @IsString()
  @MinLength(3)
  login!: string;

  @IsString()
  @Matches(PASSWORD_REGEX)
  password!: string;

  @IsUUID()
  roleId?: string;
}
