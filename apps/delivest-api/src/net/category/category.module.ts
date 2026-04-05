import { Module } from '@nestjs/common';
import { CategoryService } from './category.service.js';
import { CategoryController } from './category.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
