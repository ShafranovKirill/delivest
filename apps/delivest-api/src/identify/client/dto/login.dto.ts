import { ApiProperty } from '@nestjs/swagger';
import { LoginClientRequest } from '@delivest/types';
import { IsString } from 'class-validator';

export class LoginClientDto implements LoginClientRequest {
  @ApiProperty({
    description: 'Номер телефона клиента',
    example: '+79255355278',
    required: true,
  })
  @IsString()
  phone!: string;

  @ApiProperty({
    description: 'Код клиента для входа',
    example: '1234',
    required: true,
  })
  @IsString()
  code: string;
}
