import { Module } from '@nestjs/common';
import { ProductService } from './product.service.js';
import { ProductController } from './product.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AdminProductController } from './admin-product.controller.js';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [PrismaModule, JwtModule],
  controllers: [ProductController, AdminProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
