import { DeliveryType, OrderStatus } from "@prisma-generated/prisma/enums.js";
import { CartResponse } from "./cart.js";

export interface OrderValidationPayload {
  cartId: string;
  branchId: string;
  phone?: string;
  address?: string;
  comment?: string;
  deliveryType: DeliveryType;
  items: OrderItem[];
}

export interface ValidateOrderRequest {
  cartId: string;
  phone: string;
  branchId: string;
  deliveryType: DeliveryType;
  comment?: string;
  address?: string;
}

export interface CreateOrderRequest {
  validationToken: string;
}

export interface AdminCreateOrderRequest extends CreateOrderRequest {
  clientId: string;
  status: OrderStatus;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
}

export interface ValidateOrderResponse extends CartResponse {
  validationToken: string;
}

export interface AddToOrderRequest {
  orderId: string;
  productId: string;
  quantity: number;
}

export interface RemoveFromOrderRequest {
  orderId: string;
  productId: string;
  deleteAll: boolean;
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
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  status: OrderStatus;
}

export interface FindOrdersRequest {
  branchId?: string;
  orderStatus?: OrderStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}
