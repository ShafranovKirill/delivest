import { DeliveryType, OrderStatus } from "../../../../apps/delivest-api/generated/prisma/enums.js";
import { CartResponse } from "./cart.js";

export interface BaseOrderRequest {
  cartId: string;
  phone: string;
  branchId: string;
  deliveryType: DeliveryType;
  comment?: string;
  address?: string;
  clientId?: string;
  staffId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ValidateOrderRequest extends BaseOrderRequest {}

export interface CreateOrderRequest extends BaseOrderRequest {
  validationToken: string;
}
export interface OrderItemResponse {
  productId: string;
  title: string;
  price: number;
  quantity: number;
}

export interface ValidateOrderResponse extends CartResponse {
  validationToken: string;
}

export interface OrderResponse {
  id: string;
  orderNumber: number;
  clientId?: string;
  staffId?: string;
  status: OrderStatus;
  deliveryType: DeliveryType;
  totalPrice: number;
  address?: string;
  comment?: string;
  phone: string;
  items: OrderItemResponse[];
  createdAt: Date;
  updatedAt: Date;
}
