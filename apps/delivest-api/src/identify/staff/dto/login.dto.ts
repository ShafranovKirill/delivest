import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { LoginStaffRequest } from '@delivest/types';

export class LoginStaffDto implements LoginStaffRequest {
  @ApiProperty({
    description: 'Логин работника',
    example: 'staff',
    required: true,
  })
  @IsString()
  login!: string;

  @ApiProperty({
    description: 'Пароль работника',
    example: 'SecurePass123!',
    required: true,
  })
  @IsString()
  password!: string;
}
