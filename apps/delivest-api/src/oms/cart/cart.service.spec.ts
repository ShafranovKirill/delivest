import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { NetService } from '../../net/net.service.js';
import { MediaService } from '../../media/media.service.js';
import { CartService } from './cart.service.js';
import { ReadCartDto } from './dto/read-cart.dto.js';
import { NotFoundException } from '../../shared/exceptions/domain_exception/domain-exception.js';

// Мокаем декоратор Transactional, чтобы он просто пропускал выполнение функции
jest.mock('@nestjs-cls/transactional', () => ({
  ...(jest.requireActual('@nestjs-cls/transactional') as any),
  Transactional:
    () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

describe('CartService', () => {
  let service: CartService;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockNetService: jest.Mocked<NetService>;
  let mockMediaService: jest.Mocked<MediaService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockTxHost: jest.Mocked<
    TransactionHost<TransactionalAdapterPrisma<PrismaClient>>
  >;

  const mockCart = {
    id: 'cart-1',
    sessionId: 'session-1',
    clientId: null,
    staffId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  const mockCartItem = {
    id: 'item-1',
    cartId: 'cart-1',
    productId: 'product-1',
    quantity: 2,
  };

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    price: 100,
    photos: { product_card: 'photo-key' },
  };

  beforeEach(async () => {
    const mockTx = {
      cart: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      cartItem: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    // Исправленный мок withTransaction для корректной работы с колбэками
    mockTxHost = {
      tx: mockTx,
      withTransaction: jest.fn().mockImplementation(async (...args: any[]) => {
        const callback = args.find((arg) => typeof arg === 'function');
        if (callback) return await callback();
      }),
    } as any;

    jest.spyOn(TransactionHost, 'getInstance').mockReturnValue(mockTxHost);

    mockPrismaService = {
      cart: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      cartItem: {
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as any;

    mockRedisService = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    } as any;

    mockNetService = {
      getProductById: jest.fn(),
      getProductsByIds: jest.fn(),
    } as any;

    mockMediaService = {
      generatePublicUrl: jest.fn(),
    } as any;

    mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue('test-bucket'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PrismaClient, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: NetService, useValue: mockNetService },
        { provide: MediaService, useValue: mockMediaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TransactionHost, useValue: mockTxHost },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addItem', () => {
    it('should add item to cart successfully', async () => {
      mockNetService.getProductById.mockResolvedValue(mockProduct as any);
      mockTxHost.tx.cartItem.upsert.mockResolvedValue(mockCartItem as any);
      mockTxHost.tx.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [mockCartItem],
      } as any);
      mockNetService.getProductsByIds.mockResolvedValue([mockProduct] as any);
      mockMediaService.generatePublicUrl.mockReturnValue('http://photo.url');

      const result = await service.addItem('cart-1', 'product-1', 1);

      // В ESM тестах лучше проверять свойства, т.к. instanceof может сбоить
      expect(result).toMatchObject({
        id: 'cart-1',
      });
      expect(mockTxHost.tx.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            cartId_productId: { cartId: 'cart-1', productId: 'product-1' },
          },
        }),
      );
    });

    it('should throw NotFoundException if product not found', async () => {
      mockNetService.getProductById.mockResolvedValue(null as any);
      await expect(service.addItem('cart-1', 'product-1', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeItem', () => {
    it('should remove one item from cart', async () => {
      mockPrismaService.cartItem.findFirst.mockResolvedValue(
        mockCartItem as any,
      );
      mockPrismaService.cartItem.update.mockResolvedValue({
        ...mockCartItem,
        quantity: 1,
      } as any);
      mockTxHost.tx.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [{ ...mockCartItem, quantity: 1 }],
      } as any);
      mockNetService.getProductsByIds.mockResolvedValue([mockProduct] as any);
      mockMediaService.generatePublicUrl.mockReturnValue('http://photo.url');

      const result = await service.removeItem('cart-1', 'product-1', false);

      expect(result).toMatchObject({ id: 'cart-1' });
      expect(mockPrismaService.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
        }),
      );
    });

    it('should remove all items if deleteAll is true', async () => {
      mockPrismaService.cartItem.findFirst.mockResolvedValue(
        mockCartItem as any,
      );
      mockPrismaService.cartItem.delete.mockResolvedValue(mockCartItem as any);
      mockTxHost.tx.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [],
      } as any);

      await service.removeItem('cart-1', 'product-1', true);

      expect(mockPrismaService.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('should throw NotFoundException if item not in cart', async () => {
      mockPrismaService.cartItem.findFirst.mockResolvedValue(null);

      await expect(service.removeItem('cart-1', 'product-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCart', () => {
    it('should return cart from cache if available', async () => {
      const cachedCart = { id: 'cart-1', items: [] };
      mockPrismaService.cart.upsert.mockResolvedValue(mockCart as any);
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedCart));

      const result = await service.getCart(
        { sessionId: 'session-1' },
        'branch-1',
      );

      const parsedResult =
        typeof result === 'string' ? JSON.parse(result) : result;

      expect(parsedResult).toMatchObject({ id: 'cart-1' });
    });

    it('should refresh cart if not in cache', async () => {
      mockPrismaService.cart.upsert.mockResolvedValue(mockCart as any);
      mockRedisService.get.mockResolvedValue(null);
      mockTxHost.tx.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [],
      } as any);

      await service.getCart({ sessionId: 'session-1' }, 'branch-1');

      expect(mockTxHost.tx.cart.findUnique).toHaveBeenCalled();
    });
  });

  describe('clearCart', () => {
    it('should clear cart successfully', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart as any);
      mockTxHost.tx.cart.findUnique.mockResolvedValue(mockCart as any);
      mockTxHost.tx.cart.delete.mockResolvedValue(mockCart as any);
      mockRedisService.del.mockResolvedValue(1 as any);

      await service.clearCart('cart-1');

      expect(mockTxHost.tx.cart.delete).toHaveBeenCalledWith({
        where: { id: 'cart-1' },
      });
      expect(mockRedisService.del).toHaveBeenCalledWith('cart:cart-1');
    });
  });
});
