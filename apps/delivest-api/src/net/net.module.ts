import { Module } from '@nestjs/common';
import { NetService } from './net.service.js';
import { BranchModule } from './branch/branch.module.js';
import { CategoryModule } from './category/category.module.js';
import { ProductModule } from './product/product.module.js';

@Module({
  imports: [BranchModule, CategoryModule, ProductModule],
  providers: [NetService],
  exports: [],
})
export class NetModule {}
