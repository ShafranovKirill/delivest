import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Permission } from '../../../../generated/prisma/enums.js';
import { CreateRoleRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger/dist/decorators/index.js';

export class CreateRoleDto implements CreateRoleRequest {
  @ApiProperty({
    description: 'Имя роли',
    example: 'admin',
    required: true,
  })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({
    description: 'Разрешения роли',
    example: [`${Permission.ADMIN}`],
    required: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissions?: Permission[];
}
