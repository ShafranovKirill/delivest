import { Module } from '@nestjs/common';
import { NetService } from './net.service.js';
import { BranchModule } from './branch/branch.module.js';

@Module({
  imports: [BranchModule],
  providers: [NetService],
  exports: [],
})
export class NetModule {}
