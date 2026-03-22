import { Module } from '@nestjs/common';
import { NetService } from './net.service.js';
import { BranchModule } from './branch/branch.module.js';
import { CategoryModule } from './category/category.module.js';

@Module({
  imports: [BranchModule, CategoryModule],
  providers: [NetService],
  exports: [],
})
export class NetModule {}
