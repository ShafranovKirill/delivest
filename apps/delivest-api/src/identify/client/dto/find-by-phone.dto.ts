import { ApiProperty } from '@nestjs/swagger';
import { FindByPhoneRequest } from '@delivest/types';
import { IsString, Matches } from 'class-validator';
import { PHONE_REGEX } from '@delivest/common';

export class FindByPhoneDto implements FindByPhoneRequest {
  @ApiProperty({
    description: 'Номер телефона клиента',
    example: '+79255355278',
    required: true,
  })
  @Matches(PHONE_REGEX, {
    message: 'Номер телефона должен быть в формате +7XXXXXXXXXX',
  })
  @IsString()
  phone!: string;
}
