import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { CartItemResponse, CartResponse } from '@delivest/types';
import {
  Cart,
  CartItem,
  Prisma,
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
import { ConfigService } from '@nestjs/config/dist/index.js';
import type { CartOwner } from './interfaces/cart-owner.interface.js';
import { OnEvent } from '@nestjs/event-emitter';
import type { ClientLoggedInEvent } from '../../shared/events/types.js';

import { DelivestEvent } from '../../shared/events/types.js';

export type InternalCartWithItems = Cart & {
  items: CartItem[];
};

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private readonly bucket: string;
  private readonly CART_TTL = 5 * 24 * 60 * 60;
  private readonly CART_CACHE_PREFIX = 'cart:';
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly netService: NetService,
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
    private readonly config: ConfigService,
    private readonly mediaService: MediaService,
  ) {
    this.bucket = this.config.getOrThrow<string>('STORAGE_BUCKET_NAME');
  }
  @Transactional()
  async addItem(
    ownerId: CartOwner,
    productId: string,
    quantity: number,
  ): Promise<ReadCartDto> {
    try {
      const product = await this.netService.getProductById(productId);
      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      const where = ownerId as Prisma.CartWhereUniqueInput;

      const cart = await this.txHost.tx.cart.upsert({
        where,
        update: {},
        create: ownerId,
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

      return toDto(await this.refreshCart(ownerId), ReadCartDto);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      const cacheKey = ownerId.clientId || ownerId.staffId || ownerId.sessionId;

      this.logger.error(
        `Failed to add item ${productId} to cart for owner ${cacheKey}`,
        error,
      );
      throw new InternalErrorException(
        'Failed to add item to cart. Please try again later.',
      );
    }
  }

  async removeItem(
    ownerId: CartOwner,
    productId: string,
    deleteAll: boolean = false,
  ) {
    try {
      const cartWhere = ownerId as Prisma.CartWhereUniqueInput;
      const cartItem = await this.prisma.cartItem.findFirst({
        where: {
          cart: cartWhere,
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

      return toDto(await this.refreshCart(ownerId), ReadCartDto);
    } catch (error) {
      this.logger.error(
        `Failed to remove item ${productId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async getCart(ownerId: CartOwner): Promise<ReadCartDto> {
    const cartWhere = ownerId as Prisma.CartWhereUniqueInput;

    const cart = await this.prisma.cart.findFirst({
      where: cartWhere,
    });
    if (cart?.id) {
      const cachedCart = await this.getCartFromRedis(cart?.id);
      if (cachedCart) {
        return toDto(cachedCart, ReadCartDto);
      }
    }

    return toDto(await this.refreshCart(ownerId), ReadCartDto);
  }

  async clearCart(ownerId: CartOwner) {
    try {
      const where = ownerId as Prisma.CartWhereUniqueInput;

      const cart = await this.prisma.cart.findUnique({ where });

      if (!cart) {
        return;
      }

      await this.deleteCart(cart.id);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      const cacheKey = ownerId.clientId || ownerId.staffId || ownerId.sessionId;

      this.logger.error(`Failed to clear cart for session ${cacheKey}`, error);
      throw new InternalErrorException(
        'Failed to clear cart. Please try again later.',
      );
    }
  }

  @OnEvent(DelivestEvent.CLIENT_LOGGED_IN)
  @Transactional()
  async handleMergeClientCarts(payload: ClientLoggedInEvent) {
    const { sessionId, clientId } = payload;

    try {
      const guestCart = await this.findGuestCart(sessionId);

      if (!guestCart || guestCart.items.length === 0) {
        return await this.refreshCart({ clientId });
      }

      const clientCart = await this.findClientCart(clientId);

      if (clientCart) {
        await this.txHost.tx.cart.delete({
          where: { id: clientCart.id },
        });
      }

      await this.txHost.tx.cart.update({
        where: { id: guestCart.id },
        data: {
          clientId: clientId,
          sessionId: null,
        },
      });
      if (clientCart?.id) {
        await this.deleteCartFromRedis(clientCart.id);
      }
      if (guestCart?.id) {
        await this.deleteCartFromRedis(guestCart.id);
      }
      this.logger.log(
        `Cart merged: session ${sessionId} -> client ${clientId}. `,
      );

      return await this.refreshCart({ clientId });
    } catch (error) {
      this.logger.error(
        `Failed to merge carts for session ${sessionId} and client ${clientId}`,
        error,
      );
      throw new InternalErrorException('Failed to sync your cart.');
    }
  }

  async validateCart(cartId: string): Promise<ReadCartDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      select: {
        clientId: true,
        sessionId: true,
        staffId: true,
      },
    });

    if (!cart) {
      throw new NotFoundException(`Cart with ID ${cartId} not found`);
    }

    const ownerId: CartOwner = {
      ...(cart.clientId && { clientId: cart.clientId }),
      ...(cart.sessionId && { sessionId: cart.sessionId }),
      ...(cart.staffId && { staffId: cart.staffId }),
    };

    const response = await this.refreshCart(ownerId);

    return toDto(response, ReadCartDto);
  }

  async deleteCart(cartId: string) {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
      });

      if (!cart) return;

      await this.prisma.cart.delete({
        where: { id: cartId },
      });

      if (cart.id) {
        await this.deleteCartFromRedis(cart.id);
      }

      this.logger.log(`Cart ${cartId} fully deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete cart ${cartId}`, error);
      throw new InternalErrorException('Failed to remove cart');
    }
  }

  private async refreshCart(ownerId: CartOwner) {
    const where = ownerId as Prisma.CartWhereUniqueInput;
    const cacheKey = ownerId.clientId || ownerId.staffId || ownerId.sessionId;
    const cart = await this.txHost.tx.cart.findUnique({
      where,
      include: { items: true },
    });

    if (!cart) {
      return this.emptyCartResponse(ownerId);
    }

    const response = await this.mapCartToResponse(
      cart as InternalCartWithItems,
    );

    if (response.items.length === 0) {
      if (cacheKey) await this.deleteCartFromRedis(cart.id);
    } else {
      await this.setCartToRedis(response);
    }

    return response;
  }

  private async findGuestCart(
    sessionId: string,
  ): Promise<InternalCartWithItems | null> {
    return this.txHost.tx.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });
  }

  private async findClientCart(
    clientId: string,
  ): Promise<InternalCartWithItems | null> {
    return this.txHost.tx.cart.findUnique({
      where: { clientId },
      include: { items: true },
    });
  }

  private emptyCartResponse(ownerId: CartOwner): ReadCartDto {
    return toDto(
      {
        id: 'empty',
        items: [],
        totalPrice: 0,
        totalItems: 0,
        sessionId: ownerId.sessionId ?? null,
        clientId: ownerId.clientId ?? null,
        staffId: ownerId.staffId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ReadCartDto,
    );
  }

  private async setCartToRedis(cart: ReadCartDto) {
    try {
      await this.redisService.set(
        `${this.CART_CACHE_PREFIX}${cart.id}`,
        cart,
        this.CART_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to set cart ${cart.id} to Redis`, error);
    }
  }

  private async getCartFromRedis(cartId: string): Promise<CartResponse | null> {
    try {
      return await this.redisService.get<CartResponse>(
        `${this.CART_CACHE_PREFIX}${cartId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to get cart ${cartId} from Redis`, error);
      return null;
    }
  }

  private async deleteCartFromRedis(cartId: string) {
    try {
      await this.redisService.del(`${this.CART_CACHE_PREFIX}${cartId}`);
    } catch (error) {
      this.logger.error(`Failed to delete cart ${cartId} from Redis`, error);
    }
  }

  private async mapCartToResponse(
    cart: InternalCartWithItems,
  ): Promise<ReadCartDto> {
    const productIds = cart.items.map((item) => item.productId);
    const products = await this.netService.getProductsByIds(productIds);

    const items: CartItemResponse[] = cart.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const price = product?.price ?? 0;

      const photoUrl = this.mediaService.generatePublicUrl(
        product?.photos.product_card ?? '',
      );
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
      clientId: cart.clientId,
      staffId: cart.staffId,
      items,
      totalPrice,
      totalItems,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };

    return toDto(response, ReadCartDto);
  }
}
