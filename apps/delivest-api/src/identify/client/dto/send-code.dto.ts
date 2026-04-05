import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SendCodeDto {
  @ApiProperty({
    description: 'Номер телефона клиента',
    example: '+79255355278',
    required: true,
  })
  @IsString()
  phone!: string;
}
