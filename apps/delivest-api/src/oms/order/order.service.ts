import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CartService } from '../cart/cart.service.js';
import { NetService } from '../../net/net.service.js';
import {
  BadRequestException,
  DomainException,
  InternalErrorException,
  InvalidTokenException,
  NotFoundException,
  TokenExpiredException,
} from '../../shared/exceptions/domain_exception/domain-exception.js';
import { ReadCartDto } from '../cart/dto/read-cart.dto.js';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  type AccessStaffTokenPayload,
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
import { IdentityService } from '../../identify/identify.service.js';

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
    private readonly identityService: IdentityService,
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
    staffPayload?: AccessStaffTokenPayload,
    status: OrderStatus = 'PENDING',
  ): Promise<ReadOrderDto> {
    const orderPayload = await this.decodeAndVerifyToken(dto.validationToken);

    if (staffPayload) {
      this.identityService.checkBranchAbility(
        staffPayload,
        orderPayload.branchId,
      );
    }
    try {
      return await this.txHost.tx.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            branchId: orderPayload.branchId,
            clientId: clientId,
            staffId: staffPayload?.sub,
            status: status,
            deliveryType: orderPayload.deliveryType,
            totalPrice: this.calculateTotalPrice(orderPayload.items),
            address: orderPayload.address,
            comment: orderPayload.comment,
            phone: orderPayload.phone,

            items: {
              create: orderPayload.items.map((item) => ({
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

        await this.cartService.deleteCart(orderPayload.cartId);

        await this.statusContext.execute(order);

        this.logger.log(`Order #${order.orderNumber} created successfully`);

        return toDto(order, ReadOrderDto);
      });
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error('Failed to create order in database', error);
      throw new InternalErrorException(
        'Не удалось сохранить заказ. Попробуйте позже.',
      );
    }
  }

  @Transactional()
  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    staffPayload?: AccessStaffTokenPayload,
  ): Promise<ReadOrderDto> {
    const order = await this.txHost.tx.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (staffPayload) {
      this.identityService.checkBranchAbility(staffPayload, order?.branchId);
    }

    if (order.status === newStatus) {
      return toDto(order, ReadOrderDto);
    }

    try {
      const updatedOrder = await this.txHost.tx.order.update({
        where: { id: orderId },
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
        where: { id: orderId },
        include: { items: true },
      });

      return toDto(finalOrder, ReadOrderDto);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `updateStatus() | Failed to update status for order #${orderId}`,
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

  async findOne(id: string): Promise<ReadOrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Заказ с ID ${id} не найден`);
    }

    return toDto(order, ReadOrderDto);
  }

  async findAllByBranch(
    branchId: string,
    orderStatus?: OrderStatus,
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    limit: number = 20,
    staffPayload?: AccessStaffTokenPayload,
  ): Promise<ReadOrderDto[]> {
    if (staffPayload) {
      this.identityService.checkBranchAbility(staffPayload, branchId);
    }
    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
        status: orderStatus,
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return orders.map((order) => toDto(order, ReadOrderDto));
  }

  async findByClient(clientId: string): Promise<ReadOrderDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { clientId },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders.map((order) => toDto(order, ReadOrderDto));
  }

  @Transactional()
  async addItem(
    orderId: string,
    productId: string,
    quantity: number,
    staffPayload?: AccessStaffTokenPayload,
  ): Promise<ReadOrderDto> {
    try {
      const product = await this.netService.getProductById(productId);
      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      await this.txHost.tx.orderItem.upsert({
        where: {
          orderId_productId: {
            orderId,
            productId,
          },
        },
        update: {
          quantity: { increment: quantity },
        },
        create: {
          orderId,
          productId: productId,
          quantity: quantity,
          price: product.price,
          title: product.name,
        },
      });
      const updatedOrder = await this.txHost.tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });

      if (staffPayload) {
        this.identityService.checkBranchAbility(
          staffPayload,
          updatedOrder.branchId,
        );
      }

      return toDto(updatedOrder, ReadOrderDto);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      this.logger.error(
        `Failed to add item ${productId} to order ${orderId}`,
        error,
      );
      throw new InternalErrorException(
        'Failed to add item to cart. Please try again later.',
      );
    }
  }
  @Transactional()
  async removeItem(
    orderId: string,
    productId: string,
    deleteAll: boolean,
    staffPayload?: AccessStaffTokenPayload,
  ): Promise<ReadOrderDto> {
    try {
      const orderItem = await this.prisma.orderItem.findFirst({
        where: {
          orderId,
          productId,
        },
      });

      if (!orderItem) {
        throw new NotFoundException('Товар не найден в заказе');
      }

      if (deleteAll || orderItem.quantity <= 1) {
        await this.prisma.orderItem.delete({
          where: { id: orderItem.id },
        });
      } else {
        await this.prisma.orderItem.update({
          where: { id: orderItem.id },
          data: {
            quantity: { decrement: 1 },
          },
        });
      }

      const updatedOrder = await this.txHost.tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      if (staffPayload) {
        this.identityService.checkBranchAbility(
          staffPayload,
          updatedOrder.branchId,
        );
      }

      return toDto(updatedOrder, ReadOrderDto);
    } catch (error) {
      this.logger.error(
        `Failed to remove item ${productId}`,
        (error as Error).stack,
      );
      throw error;
    }
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
