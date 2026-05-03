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
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateProductRequest {
  name: string;
  price: number;
  branchId: string;
  weight?: number;
  quantity?: number;
  categoryId?: string;
  description?: string;
}

export type UpdateProductRequest = Partial<CreateProductRequest> & {
  productId: string;
  order?: number;
};
