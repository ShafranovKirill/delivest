import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CartService } from '../cart/cart.service.js';
import { NetService } from '../../net/net.service.js';
import {
  BadRequestException,
  InternalErrorException,
} from '../../shared/exceptions/domain_exception/domain-exception.js';
import { ReadCartDto } from '../cart/dto/read-cart.dto.js';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OrderValidationPayload, ValidateOrderRequest } from '@delivest/types';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { type ICreateOrderInternal } from './interfaces/create.interface.js';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  private readonly validationTtl: number;
  private readonly validationSecret: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cartService: CartService,
    private readonly netService: NetService,
    private readonly jwtService: JwtService,
    private readonly txHost: TransactionHost<
      TransactionalAdapterPrisma<PrismaClient>
    >,
  ) {
    this.validationSecret = this.config.getOrThrow<string>(
      'ORDER_VALIDATION_SECRET',
    );
    this.validationTtl = 3 * 1000 * 60;
  }

  @Transactional()
  async createOrder(dto: ICreateOrderInternal) {
    const cart = await this.cartService.validateCart(dto.cartId);

    if (cart.items.length === 0) {
      throw new BadRequestException('Корзина пуста');
    }

    if (dto.validationToken) {
      await this.verifyOrderToken(dto.validationToken, cart);
    }

    try {
      return await this.txHost.tx.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            clientId: dto.clientId,
            staffId: dto.staffId,
            status: dto.status,
            deliveryType: dto.deliveryType || 'PICKUP',
            totalPrice: cart.totalPrice,
            address: dto.address,
            comment: dto.comment,
            phone: dto.phone,

            items: {
              create: cart.items.map((item) => ({
                productId: item.productId,
                title: item.name,
                price: item.price,
                quantity: item.quantity,
              })),
            },
          },
          include: {
            items: true,
          },
        });

        await this.cartService.deleteCart(cart.id);

        this.logger.log(`Order #${order.orderNumber} created successfully`);

        return order;
      });
    } catch (error) {
      this.logger.error('Failed to create order in database', error);
      throw new InternalErrorException(
        'Не удалось сохранить заказ. Попробуйте позже.',
      );
    }
  }
  async validateOrder(dto: ValidateOrderRequest) {
    const cart = await this.cartService.validateCart(dto.cartId);
    if (cart.items.length === 0) {
      throw new BadRequestException('Нельзя создать заказ из пустой корзины');
    }

    const validationToken = await this.generateOrderToken(cart);

    return {
      ...cart,
      validationToken,
    };
  }

  private async generateOrderToken(cart: ReadCartDto) {
    const fingerprint = this.generateFingerprint(cart);

    const payload: OrderValidationPayload = {
      cartId: cart.id,
      totalPrice: cart.totalPrice,
      fingerprint,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.validationSecret,
      expiresIn: this.validationTtl,
    });
  }

  private async verifyOrderToken(
    token: string,
    currentCart: ReadCartDto,
  ): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<OrderValidationPayload>(
        token,
        {
          secret: this.validationSecret,
        },
      );

      const currentFingerprint = this.generateFingerprint(currentCart);

      if (payload.fingerprint !== currentFingerprint) {
        throw new BadRequestException(
          'Состав корзины изменился с момента подтверждения. Проверьте заказ еще раз.',
        );
      }

      if (payload.totalPrice !== currentCart.totalPrice) {
        throw new BadRequestException(
          'Итоговая сумма изменилась. Пожалуйста, получите актуальное подтверждение.',
        );
      }

      if (payload.cartId !== currentCart.id) {
        throw new BadRequestException('Токен предоставлен для другой корзины.');
      }
    } catch (error: unknown) {
      if (error instanceof TokenExpiredError) {
        throw new BadRequestException(
          `Время подтверждения заказа истекло (${this.validationTtl} сек). Повторите проверку.`,
        );
      }

      if (error instanceof JsonWebTokenError) {
        throw new BadRequestException('Невалидный токен подтверждения заказа.');
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Unexpected error during token verification', error);
      throw new InternalErrorException('Ошибка при проверке заказа');
    }
  }

  private generateFingerprint(cart: ReadCartDto) {
    const fingerprint = cart.items
      .map((item) => `${item.productId}:${item.quantity}`)
      .sort()
      .join('|');

    return fingerprint;
  }
}
