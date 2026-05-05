import { PhotoKey } from "../../../common/src/photo-keys.js";

export interface FindProductRequest {
  id: string;
}

export interface FindProductsByBranchRequest {
  branchId: string;
}

export interface FindProductsByCategoryRequest {
  categoryId: string;
}

export interface FindProductsByNameRequest {
  branchId: string;
  name: string;
}

export interface ProductResponse {
  id: string;
  name: string;
  price: number;
  branchId: string;
  photos: Record<PhotoKey, string>;
  categoryId?: string;
  description?: string;
  order?: number;
  weight?: number;
  quantity?: number;
  isAvailable?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateProductRequest {
  name: string;
  price: number;
  branchId: string;
  categoryId: string;
  weight?: number;
  quantity?: number;
  description?: string;
}

export type UpdateProductRequest = Partial<CreateProductRequest> & {
  productId: string;
  order?: number;
  isAvailable?: boolean;
};
