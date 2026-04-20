import { UpdateStaffRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateStaffDto implements UpdateStaffRequest {
  @ApiProperty({
    description: 'Айди работника',
    example: 'staff-123',
    required: true,
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Логин работника',
    example: 'staff',
    required: false,
  })
  @IsString()
  @IsOptional()
  login: string;

  @ApiProperty({
    description: 'Айди роли',
    example: 'role-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  roleId: string;

  @ApiProperty({
    description: 'Список айди филиалов',
    example: ['rest-1', 'rest-2'],
    required: false,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  branchIds: string[];

  @ApiProperty({
    description: 'Имя работника',
    example: 'Иван Иванов',
    required: false,
  })
  @IsString()
  @IsOptional()
  name: string;
}
