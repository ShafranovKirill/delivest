import { Module } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [],
  controllers: [StaffController],
  providers: [StaffService, ConfigService, PrismaService, JwtService],
  exports: [StaffService],
})
export class StaffModule {}
