import { UpdateStaffRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateStaffDto implements UpdateStaffRequest {
  @ApiProperty({
    description: 'Логин работника',
    example: 'staff',
    required: false,
  })
  @IsString()
  @IsOptional()
  login!: string;

  @ApiProperty({
    description: 'Айди роли',
    example: 'role-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  roleId: string;

  @ApiProperty({
    description: 'Имя работника',
    example: 'Иван Иванов',
    required: false,
  })
  @IsString()
  @IsOptional()
  name: string;
}
