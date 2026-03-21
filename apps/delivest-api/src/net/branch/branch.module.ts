import { Module } from '@nestjs/common';
import { BranchService } from './branch.service.js';
import { BranchController } from './branch.controller.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Module({
  imports: [],
  controllers: [BranchController],
  providers: [BranchService, PrismaService],
  exports: [],
})
export class BranchModule {}
