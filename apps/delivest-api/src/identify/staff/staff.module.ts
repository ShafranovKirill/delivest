import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';
import { AclModule } from '../acl/acl.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [AclModule, JwtModule, ConfigModule, PrismaModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService, JwtModule],
})
export class StaffModule {}
