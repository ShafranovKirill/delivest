import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CartService } from '../cart/cart.service.js';
import { NetService } from '../../net/net.service.js';
import {
  BadRequestException,
  InternalErrorException,
  InvalidTokenException,
  NotFoundException,
  TokenExpiredException,
} from '../../shared/exceptions/domain_exception/domain-exception.js';
import { ReadCartDto } from '../cart/dto/read-cart.dto.js';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  OrderItem,
  OrderValidationPayload,
  ValidateOrderRequest,
} from '@delivest/types';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { OrderStatus, PrismaClient } from '../../../generated/prisma/client.js';
import { toDto } from '../../utils/to-dto.js';
import { ReadOrderDto } from './dto/read.dto.js';
import { ReadValidateOrderDto } from './dto/read-validate.dto.js';
import { OrderStatusContext } from './order-status.context.js';
import { CreateOrderDto } from './dto/create.dto.js';

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
    private readonly statusContext: OrderStatusContext,
  ) {
    this.validationSecret = this.config.getOrThrow<string>(
      'ORDER_VALIDATION_SECRET',
    );
    this.validationTtl = 3 * 1000 * 60;
  }

  @Transactional()
  async createOrder(
    dto: CreateOrderDto,
    clientId?: string,
    staffId?: string,
    status: OrderStatus = 'PENDING',
  ): Promise<ReadOrderDto> {
    const tokenPayload = await this.decodeAndVerifyToken(dto.validationToken);

    try {
      return await this.txHost.tx.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            clientId: clientId,
            staffId: staffId,
            status: status,
            deliveryType: tokenPayload.deliveryType,
            totalPrice: this.calculateTotalPrice(tokenPayload.items),
            address: tokenPayload.address,
            comment: tokenPayload.comment,
            phone: tokenPayload.phone,

            items: {
              create: tokenPayload.items.map((item) => ({
                productId: item.productId,
                title: item.title,
                price: item.price,
                quantity: item.quantity,
              })),
            },
          },
          include: {
            items: true,
          },
        });

        await this.cartService.deleteCart(tokenPayload.cartId);

        await this.statusContext.execute(order);

        this.logger.log(`Order #${order.orderNumber} created successfully`);

        return toDto(order, ReadOrderDto);
      });
    } catch (error) {
      this.logger.error('Failed to create order in database', error);
      throw new InternalErrorException(
        'Не удалось сохранить заказ. Попробуйте позже.',
      );
    }
  }

  @Transactional()
  async updateStatus(id: string, newStatus: OrderStatus) {
    const order = await this.txHost.tx.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (order.status === newStatus) {
      return toDto(order, ReadOrderDto);
    }

    try {
      const updatedOrder = await this.txHost.tx.order.update({
        where: { id },
        data: { status: newStatus },
        include: {
          items: true,
        },
      });

      this.logger.log(
        `updateStatus() | Order #${updatedOrder.orderNumber} status changed: ${order.status} -> ${newStatus}`,
      );

      await this.statusContext.execute(updatedOrder);

      const finalOrder = await this.txHost.tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true },
      });

      return toDto(finalOrder, ReadOrderDto);
    } catch (error) {
      this.logger.error(
        `updateStatus() | Failed to update status for order #${id}`,
        error,
      );
      throw new InternalErrorException('Не удалось обновить статус заказа');
    }
  }
  async validateOrder(dto: ValidateOrderRequest) {
    const cart = await this.cartService.validateCart(dto.cartId);
    if (cart.items.length === 0) {
      throw new BadRequestException('Нельзя создать заказ из пустой корзины');
    }

    const validationToken = await this.generateOrderToken(cart, dto);

    const result = {
      ...cart,
      validationToken,
    };

    return toDto(result, ReadValidateOrderDto);
  }

  private async generateOrderToken(
    cart: ReadCartDto,
    dto: ValidateOrderRequest,
  ) {
    const payload: OrderValidationPayload = {
      cartId: cart.id,
      branchId: dto.branchId,
      phone: dto.phone,
      address: dto.address,
      comment: dto.comment,
      deliveryType: dto.deliveryType,
      items: cart.items.map((item) => ({
        productId: item.productId,
        title: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.validationSecret,
      expiresIn: this.validationTtl,
    });
  }

  private calculateTotalPrice(items: OrderItem[]): number {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  }

  private async decodeAndVerifyToken(
    token: string,
  ): Promise<OrderValidationPayload> {
    try {
      return await this.jwtService.verifyAsync<OrderValidationPayload>(token, {
        secret: this.validationSecret,
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Token verification failed: ${(error as Error).message}`,
      );

      if (error instanceof TokenExpiredError) {
        throw new TokenExpiredException(
          'Время подтверждения заказа истекло. Пожалуйста, проверьте корзину еще раз.',
        );
      }

      if (error instanceof JsonWebTokenError) {
        throw new InvalidTokenException(
          'Невалидный токен подтверждения. Попробуйте оформить заказ заново.',
        );
      }

      throw new InternalErrorException('Ошибка при проверке данных заказа');
    }
  }
}
