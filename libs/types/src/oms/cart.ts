export interface CartItemResponse {
  productId: string;
  quantity: number;
  name: string;
  price: number;
  photoUrl?: string | null;
  totalPrice: number;
}

export interface AddToCartRequest {
  cartId: string;
  productId: string;
  quantity: number;
}

export interface RemoveFromCartRequest {
  cartId: string;
  productId: string;
  deleteAll: boolean;
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
