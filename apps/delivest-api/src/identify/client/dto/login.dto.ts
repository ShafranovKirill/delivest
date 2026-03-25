import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_REGEX } from '@delivest/common';
import { LoginClientRequest } from '@delivest/types';
import { IsString, Matches } from 'class-validator';

export class LoginClientDto implements LoginClientRequest {
  @ApiProperty({
    description: 'Номер телефона клиента',
    example: '+79255355278',
    required: true,
  })
  @IsString()
  phone!: string;

  @ApiProperty({
    description: 'Пароль клиента',
    example: 'SecurePass123!',
    required: true,
    pattern: PASSWORD_REGEX.source,
  })
  @IsString()
  @Matches(PASSWORD_REGEX)
  password!: string;
}
