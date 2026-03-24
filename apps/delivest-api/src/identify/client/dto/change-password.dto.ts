import { PASSWORD_REGEX } from '@delivest/common';
import { ChangePasswordRequest } from '@delivest/types';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, {
    message: 'Password is too weak',
  })
  newPassword!: string;
}
