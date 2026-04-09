export interface CartItem {
  productId: string;
  quantity: number;
}

export interface CartItemResponse {
  productId: string;
  quantity: number;
  name: string;
  price: number;
  totalPrice: number;
}

export interface AddToCartRequest {
  productId: string;
  quantity: number;
}

export interface DeleteFromCartRequest {
  productId: string;
  quantity: number;
}

export interface CartResponse {
  id: string;
  sessionId: string;
  items: CartItemResponse[];
  totalPrice: number;
  totalItems: number;
  createdAt: Date;
  updatedAt: Date;
}
