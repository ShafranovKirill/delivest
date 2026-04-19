import { PASSWORD_REGEX } from '@delivest/common';
import { CreateStaffRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, Matches } from 'class-validator';

export class CreateStaffDto implements CreateStaffRequest {
  @ApiProperty({
    description: 'Список айди филиалов',
    example: ['rest-1', 'rest-2'],
    required: true,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  branchIds: string[];

  @ApiProperty({
    description: 'Логин работника',
    example: 'staff',
    required: true,
  })
  @IsString()
  login!: string;

  @ApiProperty({
    description: 'Пароль (минимум 8 символов, буквы и цифры)',
    example: 'SecurePass123!',
    pattern: PASSWORD_REGEX.source,
  })
  @IsString()
  @Matches(PASSWORD_REGEX)
  password!: string;

  @ApiProperty({
    description: 'Айди роли',
    example: 'role-123',
    required: true,
  })
  @IsString()
  roleId: string;

  @ApiProperty({
    description: 'Имя работника',
    example: 'Иван Иванов',
    required: true,
  })
  @IsString()
  @IsString()
  name: string;
}
