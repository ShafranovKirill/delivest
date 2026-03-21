import { Module } from '@nestjs/common';
import { BranchService } from './branch.service';
import { BranchController } from './branch.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [],
  controllers: [BranchController],
  providers: [BranchService, PrismaService],
  exports: [],
})
export class NetModule {}
