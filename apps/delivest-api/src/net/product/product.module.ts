import { Module } from '@nestjs/common';
import { ProductService } from './product.service.js';
import { ProductController } from './product.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AdminProductController } from './admin-product.controller.js';
import { JwtModule } from '@nestjs/jwt';
import { PhotoQueueModule } from '../../media/photo-queue/photo-queue.module.js';
import { MediaModule } from '../../media/media.module.js';
import { NotificationModule } from '../../notification/notification.module.js';

@Module({
  imports: [
    PrismaModule,
    JwtModule,
    PhotoQueueModule,
    MediaModule,
    NotificationModule,
  ],
  controllers: [ProductController, AdminProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
