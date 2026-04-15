export interface CartItemResponse {
  productId: string;
  quantity: number;
  name: string;
  price: number;
  photoUrl?: string;
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
  sessionId?: string | null;
  clientId?: string | null;
  staffId?: string | null;
  items: CartItemResponse[];
  totalPrice: number;
  totalItems: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderValidationPayload {
  cartId: string;
  totalPrice: number;
  fingerprint: string;
}
