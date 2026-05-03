import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BranchService } from '../../branch/branch.service.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class ProductsReorderWorker {
  private readonly logger = new Logger(ProductsReorderWorker.name);
  constructor(
    private readonly productService: ProductService,
    private readonly branchService: BranchService,
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async handleReorder() {
    try {
      const branches = await this.branchService.findAll();

      const reorderPromises = branches.map((branch) =>
        this.productService.reorderProductsForBranch(branch.id),
      );

      await Promise.all(reorderPromises);

      this.logger.log(
        `Successfully reordered products for ${branches.length} branches.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to reorder products: ${(error as Error).message}`,
      );
    }
  }
}
