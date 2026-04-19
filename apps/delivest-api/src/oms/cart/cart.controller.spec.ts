import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { ReadCartDto } from './dto/read-cart.dto.js';
import { AddToCartDto } from './dto/add-item.dto.js';
import { RemoveFromCartDto } from './dto/remove-item.dto.js';
import { OptionalJwtClientAuthGuard } from '../../identify/client/guards/jwt-client-optional.guard.js';

describe('CartController', () => {
  let controller: CartController;
  let mockCartService: jest.Mocked<CartService>;

  const mockCartDto: ReadCartDto = {
    id: 'cart-1',
    sessionId: 'session-1',
    clientId: null as any,
    staffId: null as any,
    items: [],
    totalPrice: 0,
    totalItems: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockCartService = {
      getCart: jest.fn(),
      addItem: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mockCartService }],
    })
      .overrideGuard(OptionalJwtClientAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CartController>(CartController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return cart', async () => {
      mockCartService.getCart.mockResolvedValue(mockCartDto);

      const result = await controller.getCart(
        { sessionId: 'session-1' },
        'branch-1',
      );

      expect(result).toEqual(mockCartDto);
      expect(mockCartService.getCart).toHaveBeenCalledWith(
        { sessionId: 'session-1' },
        'branch-1',
      );
    });
  });

  describe('addItem', () => {
    it('should add item to cart', async () => {
      const dto: AddToCartDto = {
        cartId: 'cart-1',
        productId: 'product-1',
        quantity: 1,
      };
      mockCartService.addItem.mockResolvedValue(mockCartDto);

      const result = await controller.addItem(dto);

      expect(result).toEqual(mockCartDto);
      expect(mockCartService.addItem).toHaveBeenCalledWith(
        'cart-1',
        'product-1',
        1,
      );
    });
  });

  describe('removeOne', () => {
    it('should remove item from cart', async () => {
      const dto: RemoveFromCartDto = {
        cartId: 'cart-1',
        productId: 'product-1',
        deleteAll: false,
      };
      mockCartService.removeItem.mockResolvedValue(mockCartDto);

      const result = await controller.removeOne(
        { sessionId: 'session-1' },
        dto,
      );

      expect(result).toEqual(mockCartDto);
      expect(mockCartService.removeItem).toHaveBeenCalledWith(
        'cart-1',
        'product-1',
        false,
      );
    });
  });

  describe('clear', () => {
    it('should clear cart', async () => {
      mockCartService.clearCart.mockResolvedValue(undefined);

      const result = await controller.clear('cart-1');

      expect(result).toEqual({ success: true, message: 'Cart cleared' });
      expect(mockCartService.clearCart).toHaveBeenCalledWith('cart-1');
    });
  });
});
