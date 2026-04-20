import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';
import { AclModule } from '../acl/acl.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { BranchAbilityService } from './branch-ability.service.js';

@Module({
  imports: [AclModule, JwtModule, ConfigModule, PrismaModule],
  controllers: [StaffController],
  providers: [StaffService, BranchAbilityService],
  exports: [StaffService, BranchAbilityService],
})
export class StaffModule {}
