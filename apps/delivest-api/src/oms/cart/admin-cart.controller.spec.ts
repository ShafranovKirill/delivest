import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { AdminCartController } from './admin-cart.controller.js';
import { CartService } from './cart.service.js';
import { ReadCartDto } from './dto/read-cart.dto.js';
import { AddToCartDto } from './dto/add-item.dto.js';
import { RemoveFromCartDto } from './dto/remove-item.dto.js';
import { JwtStaffAuthGuard } from '../../identify/index.js';
import { AclGuard } from '../../identify/acl/guards/acl.guard.js';

describe('AdminCartController', () => {
  let controller: AdminCartController;
  let mockCartService: jest.Mocked<CartService>;

  const mockCartDto: ReadCartDto = {
    id: 'cart-1',
    sessionId: null as any,
    clientId: null as any,
    staffId: 'staff-1',
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
      controllers: [AdminCartController],
      providers: [{ provide: CartService, useValue: mockCartService }],
    })
      .overrideGuard(JwtStaffAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AclGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminCartController>(AdminCartController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStaffCart', () => {
    it('should return staff cart', async () => {
      mockCartService.getCart.mockResolvedValue(mockCartDto);

      const result = await controller.getStaffCart('staff-1', 'branch-1');

      expect(result).toEqual(mockCartDto);
      expect(mockCartService.getCart).toHaveBeenCalledWith(
        { staffId: 'staff-1' },
        'branch-1',
      );
    });
  });

  describe('addItem', () => {
    it('should add item to staff cart', async () => {
      const dto: AddToCartDto = {
        cartId: 'cart-1',
        productId: 'product-1',
        quantity: 1,
      };
      mockCartService.addItem.mockResolvedValue(mockCartDto);

      const result = await controller.addItem('staff-1', dto);

      expect(result).toEqual(mockCartDto);
      expect(mockCartService.addItem).toHaveBeenCalledWith(
        'cart-1',
        'product-1',
        1,
      );
    });
  });

  describe('removeOne', () => {
    it('should remove item from staff cart', async () => {
      const dto: RemoveFromCartDto = {
        cartId: 'cart-1',
        productId: 'product-1',
        deleteAll: false,
      };
      mockCartService.removeItem.mockResolvedValue(mockCartDto);

      const result = await controller.removeOne(dto);

      expect(result).toEqual(mockCartDto);
      expect(mockCartService.removeItem).toHaveBeenCalledWith(
        'cart-1',
        'product-1',
        false,
      );
    });
  });

  describe('clearStaffCart', () => {
    it('should clear staff cart', async () => {
      mockCartService.clearCart.mockResolvedValue(undefined);

      const result = await controller.clearStaffCart('cart-1');

      expect(result).toEqual({ success: true, message: 'Staff cart cleared' });
      expect(mockCartService.clearCart).toHaveBeenCalledWith('cart-1');
    });
  });
});
