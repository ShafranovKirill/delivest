import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CartService } from '../cart/cart.service.js';
import { NetService } from '../../net/net.service.js';
import { ICreateOrderInternal } from './interfaces/create.interface.js';
import { BadRequestException } from '../../shared/exceptions/domain_exception/domain-exception.js';
import { ReadCartDto } from '../cart/dto/read-cart.dto.js';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly netService: NetService,
  ) {}

  async validateOrder(dto: ICreateOrderInternal) {
    const cart = await this.cartService.validateCart(dto.cartId);
    if (cart.items.length === 0) {
      throw new BadRequestException('Нельзя создать заказ из пустой корзины');
    }
  }

  async generateOrderToken(cart: ReadCartDto) {
    const itemsHash = jwt;
  }
}
