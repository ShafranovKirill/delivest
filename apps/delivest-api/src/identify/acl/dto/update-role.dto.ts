import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Permission } from '../../../../generated/prisma/enums.js';
import { UpdateRoleRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger/dist/decorators/index.js';

export class UpdateRoleDto implements UpdateRoleRequest {
  @ApiProperty({
    description: 'Имя роли',
    example: 'admin',
    required: true,
  })
  @IsString()
  @IsOptional()
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
