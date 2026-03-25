import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_REGEX } from '@delivest/common';
import { ChangePasswordRequest } from '@delivest/types';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiProperty({
    description: 'Текущий пароль',
    example: 'OldPass123',
    required: true,
  })
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @ApiProperty({
    description: 'Новый пароль (минимум 8 символов, буквы и цифры)',
    example: 'NewSecurePass456',
    required: true,
    minLength: 8,
    pattern: PASSWORD_REGEX.source,
  })
  @IsString()
  @MinLength(8)
  @Matches(PASSWORD_REGEX, {
    message: 'Password is too weak',
  })
  newPassword!: string;
}
