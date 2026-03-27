import { PASSWORD_REGEX, PHONE_REGEX } from '@delivest/common';
import { CreateClientRequest } from '@delivest/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches, IsOptional } from 'class-validator';

export class CreateClientDto implements CreateClientRequest {
  @ApiProperty({
    description: 'Номер телефона',
    example: '+79255355278',
    pattern: PHONE_REGEX.source,
    required: true,
  })
  @IsString()
  @Matches(PHONE_REGEX)
  phone!: string;

  @ApiPropertyOptional({
    description: 'Пароль (минимум 8 символов, буквы и цифры)',
    example: 'SecurePass123!',
    pattern: PASSWORD_REGEX.source,
    required: false,
  })
  @IsString()
  @Matches(PASSWORD_REGEX)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({
    description: 'Имя клиента',
    example: 'Иван Иванов',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;
}
