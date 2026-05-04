import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BranchService } from '../../branch/branch.service.js';
import { ProductService } from '../product.service.js';
import { CategoryService } from '../../category/category.service.js';

@Injectable()
export class ProductsReorderWorker {
  private readonly logger = new Logger(ProductsReorderWorker.name);
  constructor(
    private readonly productService: ProductService,
    private readonly branchService: BranchService,
    private readonly categoryService: CategoryService,
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async handleReorder() {
    try {
      const branches = await this.branchService.findAll();
      let totalCategories = 0;

      for (const branch of branches) {
        const categories = await this.categoryService.findAllByBranch(
          branch.id,
        );
        totalCategories += categories.length;

        const reorderPromises = categories.map((category) =>
          this.productService.reorderProductsForCategory(category.id),
        );

        await Promise.all(reorderPromises);
      }

      this.logger.log(
        `Successfully reordered products for ${totalCategories} categories across ${branches.length} branches.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to reorder products: ${(error as Error).message}`,
      );
    }
  }
}
