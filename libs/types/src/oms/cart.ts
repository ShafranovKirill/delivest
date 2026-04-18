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

export interface RemoveFromCartRequest {
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
