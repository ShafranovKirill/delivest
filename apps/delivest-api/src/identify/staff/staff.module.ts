import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtModule } from '@nestjs/jwt';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';
import { AclModule } from '../acl/acl.module.js';

@Module({
  imports: [AclModule, JwtModule, ConfigModule],
  controllers: [StaffController],
  providers: [StaffService, PrismaService],
  exports: [StaffService, JwtModule],
})
export class StaffModule {}
