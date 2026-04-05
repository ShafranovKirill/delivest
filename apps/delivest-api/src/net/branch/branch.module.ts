import { Module } from '@nestjs/common';
import { BranchService } from './branch.service.js';
import { BranchController } from './branch.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [BranchController],
  providers: [BranchService],
  exports: [BranchService],
})
export class BranchModule {}
