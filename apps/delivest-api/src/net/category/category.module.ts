import { Module } from '@nestjs/common';
import { CategoryService } from './category.service.js';
import { CategoryController } from './category.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AdminCategoryController } from './admin-category.controller.js';
import { JwtModule } from '@nestjs/jwt';
import { IdentityModule } from '../../identify/identify.module.js';

@Module({
  imports: [PrismaModule, JwtModule, IdentityModule],
  controllers: [CategoryController, AdminCategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
