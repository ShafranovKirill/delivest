import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CartItemResponse, CartResponse } from '@delivest/types';
import {
  Cart,
  CartItem,
  PrismaClient,
} from '../../../generated/prisma/client.js';
import { NetService } from '../../net/net.service.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadCartDto } from './dto/read-cart.dto.js';
import {
  DomainException,
  InternalErrorException,
  NotFoundException,
} from '../../shared/exceptions/domain_exception/domain-exception.js';
import { RedisService } from '../../redis/redis.service.js';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { MediaService } from '../../media/media.service.js';
import { PHOTO_KEYS } from '@delivest/common';

export type InternalCartWithItems = Cart & {
  items: CartItem[];
};

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private readonly CART_TTL = 5 * 24 * 60 * 60;
  private readonly CART_CACHE_PREFIX = 'cart:';
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly netService: NetService,
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
    private readonly mediaService: MediaService,
  ) {}
  @Transactional()
  async addItem(
    sessionId: string,
    productId: string,
    quantity: number,
  ): Promise<ReadCartDto> {
    try {
      const product = await this.netService.getProductById(productId);
      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }
      const cart = await this.txHost.tx.cart.upsert({
        where: { sessionId },
        update: {},
        create: { sessionId },
      });
      await this.txHost.tx.cartItem.upsert({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: productId,
          },
        },
        update: {
          quantity: { increment: quantity },
        },
        create: {
          cartId: cart.id,
          productId: productId,
          quantity: quantity,
        },
      });

      return toDto(await this.refreshCart(sessionId), ReadCartDto);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `Failed to add item ${productId} to cart for session ${sessionId}`,
        error,
      );
      throw new InternalErrorException(
        'Failed to add item to cart. Please try again later.',
      );
    }
  }

  async removeItem(
    sessionId: string,
    productId: string,
    deleteAll: boolean = false,
  ) {
    try {
      const cartItem = await this.prisma.cartItem.findFirst({
        where: {
          cart: { sessionId },
          productId,
        },
      });

      if (!cartItem) {
        throw new NotFoundException('Товар не найден в корзине');
      }

      if (deleteAll || cartItem.quantity <= 1) {
        await this.prisma.cartItem.delete({
          where: { id: cartItem.id },
        });
      } else {
        await this.prisma.cartItem.update({
          where: { id: cartItem.id },
          data: {
            quantity: { decrement: 1 },
          },
        });
      }

      return toDto(await this.refreshCart(sessionId), ReadCartDto);
    } catch (error) {
      this.logger.error(
        `Failed to remove item ${productId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async getCart(sessionId: string): Promise<ReadCartDto> {
    const cachedCart = await this.getCartFromRedis(sessionId);
    if (cachedCart) {
      return toDto(cachedCart, ReadCartDto);
    }

    return toDto(await this.refreshCart(sessionId), ReadCartDto);
  }

  async clearCart(sessionId: string) {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { sessionId },
      });

      if (!cart) {
        throw new NotFoundException(`Cart for session ${sessionId} not found`);
      }

      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      await this.deleteCartFromRedis(sessionId);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(`Failed to clear cart for session ${sessionId}`, error);
      throw new InternalErrorException(
        'Failed to clear cart. Please try again later.',
      );
    }
  }

  async validateCart(sessionId: string): Promise<ReadCartDto> {
    const response = await this.refreshCart(sessionId);

    return toDto(response, ReadCartDto);
  }

  private async refreshCart(sessionId: string) {
    const cart = await this.txHost.tx.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });

    if (!cart) {
      throw new NotFoundException(`Cart for session ${sessionId} not found`);
    }

    const response = await this.mapCartToResponse(
      cart as InternalCartWithItems,
    );

    if (response.items.length === 0) {
      await this.deleteCartFromRedis(sessionId);
    } else {
      await this.setCartToRedis(response);
    }

    return response;
  }

  private async setCartToRedis(cart: CartResponse) {
    try {
      await this.redisService.set(
        `${this.CART_CACHE_PREFIX}${cart.sessionId}`,
        cart,
        this.CART_TTL,
      );
    } catch (error) {
      this.logger.error(
        `Failed to set cart for session ${cart.sessionId} to Redis`,
        error,
      );
    }
  }

  private async getCartFromRedis(
    sessionId: string,
  ): Promise<CartResponse | null> {
    try {
      return await this.redisService.get<CartResponse>(
        `${this.CART_CACHE_PREFIX}${sessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get cart for session ${sessionId} from Redis`,
        error,
      );
      return null;
    }
  }

  private async deleteCartFromRedis(sessionId: string) {
    try {
      await this.redisService.del(`${this.CART_CACHE_PREFIX}${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete cart for session ${sessionId} from Redis`,
        error,
      );
    }
  }

  private async mapCartToResponse(
    cart: InternalCartWithItems,
  ): Promise<ReadCartDto> {
    const productIds = cart.items.map((item) => item.productId);
    const products = await this.netService.getProductsByIds(productIds);

    const photoUrlsMap = await this.mediaService.getEntityUrlsMap(
      'product',
      productIds,
      PHOTO_KEYS.PRODUCT_CARD,
    );

    const items: CartItemResponse[] = cart.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const price = product?.price ?? 0;

      const photoUrl = photoUrlsMap[item.productId];
      return {
        productId: item.productId,
        quantity: item.quantity,
        name: product?.name ?? 'Unknown',
        price: price,
        totalPrice: price * item.quantity,
        photoUrl: photoUrl,
      };
    });

    const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
    const totalPrice = items.reduce((acc, i) => acc + i.totalPrice, 0);

    const response: CartResponse = {
      id: cart.id,
      sessionId: cart.sessionId,
      items,
      totalPrice,
      totalItems,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };

    return toDto(response, ReadCartDto);
  }
}
