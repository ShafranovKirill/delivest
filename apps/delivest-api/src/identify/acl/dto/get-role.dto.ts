import { GetRoleRequest } from '@delivest/types';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetRoleDto implements GetRoleRequest {
  @ApiProperty({
    description: 'Id роли',
    example: '123',
  })
  @IsString()
  @IsNotEmpty()
  id!: string;
}
