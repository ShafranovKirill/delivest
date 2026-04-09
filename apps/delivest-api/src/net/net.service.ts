import { Injectable, Logger } from '@nestjs/common';
import { BranchService } from './branch/branch.service.js';
import { ProductService } from './product/product.service.js';
import { AdminReadProductDto } from './product/dto/admin-read.dto.js';

@Injectable()
export class NetService {
  private readonly logger = new Logger(NetService.name);
  constructor(
    private readonly branchServise: BranchService,
    private readonly productService: ProductService,
  ) {}

  async getProductById(id: string): Promise<AdminReadProductDto> {
    return this.productService.findOne(id, true);
  }

  async getProductsByIds(ids: string[]): Promise<AdminReadProductDto[]> {
    return this.productService.findManyByIds(ids, true);
  }
}
